# Setup Guide & Deployment Manual (Ubuntu on Google Cloud)

This guide provides comprehensive instructions for deploying, configuring, and operating both the Backend API/WebSocket server and the Next.js Admin Dashboard of the **OCPP-CPMS** on a local development machine or a production **Google Cloud Platform (GCP) Ubuntu 24.04 LTS VM**.

---

## 1. Local Development Setup

### Prerequisites
- **Node.js** 24.15.0+ (LTS) / Node 22+
- **PostgreSQL** 15+
- **Redis** 7+

### 1.1 Backend Setup
```bash
cd Backend
npm install
cp .env.example .env
# Edit .env to set your DATABASE_URL, REDIS_URL, and JWT_SECRET
npm run prisma:generate
npx prisma db push --accept-data-loss

# Create the initial Superadmin account
npm run create-superadmin -- "superadmin@example.com" "secure_password123"

# Start the development server
npm run dev
```

### 1.2 Frontend Setup
```bash
cd ../Frontend
npm install
cat <<EOT >> .env.local
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
EOT
npm run dev
```

---

## 2. Production Deployment on Google Cloud (Ubuntu VM)

### Production Architecture Overview
* **Frontend Dashboard URL:** `https://ui.mobilitypulse.com` (Served via Next.js on port 3002, proxied by Nginx)
* **Backend API & WebSockets:** `https://ocpp.mobilitypulse.com` (Served via Node.js on port 3000, proxied by Nginx)
* **OCPP WebSocket Engine:** Handled securely over WSS (`wss://ocpp.mobilitypulse.com/OCPP/[1.6|2.1]/{id}`) and proxied to port 9220.
* **Process Manager:** PM2 with automatic systemd startup and log rotation.
* **Database:** PostgreSQL 15+ (local or Google Cloud SQL).
* **Caching & Message Broker:** Redis 7+ (`redis-server`) with BullMQ worker queues.
* **Reverse Proxy & SSL:** Nginx with Let's Encrypt automated TLS (Certbot).

---

### 2.1 Server Provisioning & Initial Setup

1. Create a VM Instance on GCP using an **Ubuntu 24.04 LTS** image (e.g., `e2-standard-2` or `e2-medium`).
2. Reserve and assign a **Static External IP Address** to your VM in the GCP Console.
3. Configure your DNS provider to create `A Records`:
   - `ui.mobilitypulse.com` → `[Your Static IP]`
   - `ocpp.mobilitypulse.com` → `[Your Static IP]`
4. Ensure GCP Firewall rules allow incoming traffic on ports **80 (HTTP)** and **443 (HTTPS)**.

SSH into your VM and update system packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install git curl ufw -y
```

**Configure UFW Firewall:**
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

### 2.2 Install Runtime Dependencies

**Install Node.js (v24+) & PM2:**
```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

**Install PostgreSQL:**
```bash
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql.service
sudo systemctl enable postgresql.service

# Setup Database and User
sudo -u postgres psql -c "CREATE DATABASE ocpp_cms;"
sudo -u postgres psql -c "CREATE USER cms_user WITH PASSWORD 'your_secure_password';"
sudo -u postgres psql -c "ALTER ROLE cms_user SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE cms_user SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE cms_user SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ocpp_cms TO cms_user;"
sudo -u postgres psql -d ocpp_cms -c "GRANT ALL ON SCHEMA public TO cms_user;"
```

**Install Redis:**
```bash
sudo apt install redis-server -y
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Install Nginx & Certbot:**
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

---

### 2.3 Clone & Setup the Application

```bash
sudo mkdir -p /var/www
cd /var/www/
sudo git clone https://github.com/webdotpulse/OCPP-CPMS.git ocpp-cms
sudo chown -R $USER:$USER /var/www/ocpp-cms
cd ocpp-cms
```

#### Backend Setup
```bash
cd /var/www/ocpp-cms/Backend
npm install

# Create environment configuration
cat <<EOT >> .env
DATABASE_URL="postgresql://cms_user:your_secure_password@localhost:5432/ocpp_cms?schema=public"
PORT=3000
OCPP_PORT=9220
OCPP_LOG_WS_PORT=3001
JWT_SECRET="$(openssl rand -hex 32)"
REDIS_URL="redis://localhost:6379"
TZ="Europe/Brussels"

# Payment Gateways (Optional)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
MOLLIE_API_KEY="test_..."

# Smart Charging & EPEX
ENTSOE_API_KEY=""

# SMTP Mail Server
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT=587
SMTP_USER="postmaster@yourdomain.com"
SMTP_PASS="smtp_password"
SMTP_FROM="Mobility Pulse <no-reply@mobilitypulse.com>"
EOT

# Generate Prisma Client & Sync Database Schema
npx prisma generate
npx prisma db push --accept-data-loss

# Create initial Superadmin account
npm run create-superadmin -- "admin@mobilitypulse.com" "SuperSecurePassword123!"
```

#### Frontend Setup & Production Build
```bash
cd /var/www/ocpp-cms/Frontend
npm install

cat <<EOT >> .env.production
NEXT_PUBLIC_API_URL="https://ocpp.mobilitypulse.com/api"
EOT

npm run build
```

---

### 2.4 PM2 Process Configuration

Create an ecosystem file `/var/www/ocpp-cms/ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [
    {
      name: "ocpp-backend",
      cwd: "/var/www/ocpp-cms/Backend",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "ocpp-frontend",
      cwd: "/var/www/ocpp-cms/Frontend",
      script: "node_modules/.bin/next",
      args: "start -p 3002",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
```

Start applications with PM2 and configure auto-restart on system reboot:
```bash
cd /var/www/ocpp-cms
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd
```

---

### 2.5 Nginx Configuration with SSL

Create `/etc/nginx/sites-available/ocpp-cms`:
```nginx
# 1. Frontend Dashboard
server {
    server_name ui.mobilitypulse.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 2. Backend REST API & Real-Time WebSockets
server {
    server_name ocpp.mobilitypulse.com;

    # REST API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO Realtime stream
    location /api/realtime/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Live Log Stream
    location /api/ocpp/logs {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # OCPP 1.6 & 2.1 WebSocket Server
    location /OCPP/ {
        proxy_pass http://127.0.0.1:9220/OCPP/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable the configuration and obtain SSL certificates:
```bash
sudo ln -s /etc/nginx/sites-available/ocpp-cms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Obtain Let's Encrypt Certificates
sudo certbot --nginx -d ui.mobilitypulse.com -d ocpp.mobilitypulse.com
```
