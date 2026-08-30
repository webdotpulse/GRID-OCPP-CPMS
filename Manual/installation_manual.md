# OCPP Charge Point Management System (CPMS)
# Comprehensive Installation, Deployment & Infrastructure Manual

Welcome to the **OCPP-CPMS Installation and Deployment Manual**. This guide provides end-to-end instructions for deploying, configuring, and operating both the Backend API / WebSocket engine and the Next.js Admin Dashboard on a local development workstation, a bare-metal server, or a production cloud virtual machine (Ubuntu 24.04 LTS on Google Cloud, AWS, Azure, or Hetzner).

---

## Table of Contents

1. [System Architecture & Infrastructure Sizing](#1-system-architecture--infrastructure-sizing)
2. [Prerequisites & System Dependencies](#2-prerequisites--system-dependencies)
3. [Automated 1-Command Installer & Web Wizard](#3-automated-1-command-installer--web-wizard)
4. [Step-by-Step Local Development Setup](#4-step-by-step-local-development-setup)
5. [Production Server Provisioning (Ubuntu 24.04 LTS)](#5-production-server-provisioning-ubuntu-2404-lts)
6. [PostgreSQL Database & Prisma ORM Configuration](#6-postgresql-database--prisma-orm-configuration)
7. [Redis Caching & BullMQ Queue Configuration](#7-redis-caching--bullmq-queue-configuration)
8. [Backend API & OCPP WebSocket Engine Deployment](#8-backend-api--ocpp-websocket-engine-deployment)
9. [Frontend Next.js Admin Dashboard Deployment](#9-frontend-nextjs-admin-dashboard-deployment)
10. [Nginx Reverse Proxy, TLS Certificates & WSS Routing](#10-nginx-reverse-proxy-tls-certificates--wss-routing)
11. [PM2 Process Management & Systemd Automation](#11-pm2-process-management--systemd-automation)
12. [Firewall & Network Security (UFW)](#12-firewall--network-security-ufw)
13. [Environment Configuration Reference (.env)](#13-environment-configuration-reference-env)
14. [Connecting Physical Chargers & Straight-Through Proxy](#14-connecting-physical-chargers--straight-through-proxy)
15. [Health Checks, Monitoring & Troubleshooting](#15-health-checks-monitoring--troubleshooting)

---

## 1. System Architecture & Infrastructure Sizing

The CPMS is built on a decoupled, micro-service ready architecture that scales from single-site deployments to networks managing tens of thousands of concurrent EV chargers.

```text
                             ┌───────────────────────────────────┐
                             │       Nginx Reverse Proxy         │
                             │     Port 80 / 443 (Let's Encrypt) │
                             └─┬───────────────┬───────────────┬─┘
                               │               │               │
            ┌──────────────────┘               │               └──────────────────┐
            ▼                                  ▼                                  ▼
 ┌─────────────────────┐            ┌─────────────────────┐            ┌─────────────────────┐
 │ Frontend Dashboard  │            │  Backend REST API   │            │ OCPP WSS Server     │
 │ Next.js 16 (React19)│            │  Express + TS (ESM) │            │ ws Engine (RFC6455) │
 │ Port 3002           │            │  Port 3000          │            │ Port 9220           │
 └─────────────────────┘            └──────────┬──────────┘            └──────────┬──────────┘
                                               │                                  │
                                               ▼                                  ▼
                                    ┌────────────────────────────────────────────────────────┐
                                    │               PostgreSQL Database 15+                  │
                                    │                 Prisma ORM 7.8 Client                  │
                                    └──────────────────────────┬─────────────────────────────┘
                                                               │
                                                               ▼
                                    ┌────────────────────────────────────────────────────────┐
                                    │               Redis 7+ & BullMQ Worker                 │
                                    │          Pub/Sub, Telemetry Cache, Rate Limiter        │
                                    └────────────────────────────────────────────────────────┘
```

### Hardware Sizing Guidelines

| Fleet Size | Minimum CPU | Minimum RAM | Database Storage | Redis RAM | Recommended Cloud Instance |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Development / Testing** | 2 vCPU | 4 GB | 20 GB SSD | 1 GB | GCP `e2-medium` / AWS `t3.medium` |
| **1 - 100 Chargers** | 2 vCPU | 8 GB | 50 GB NVMe | 2 GB | GCP `e2-standard-2` / AWS `t3.large` |
| **100 - 1,000 Chargers** | 4 vCPU | 16 GB | 200 GB NVMe | 4 GB | GCP `e2-standard-4` / AWS `c6i.xlarge` |
| **1,000 - 10,000 Chargers** | 8+ vCPU | 32+ GB | 500+ GB NVMe | 8+ GB | GCP `c2-standard-8` / Dedicated Cluster |

---

## 2. Prerequisites & System Dependencies

Before beginning the installation, ensure the host system has:
* **Operating System:** Ubuntu 22.04 / 24.04 LTS, Debian 12, or macOS (development only).
* **Node.js:** `v24.x` or `v22.x` (LTS releases recommended).
* **Package Manager:** `npm` (v10+) or `pnpm` (v9+).
* **Database:** PostgreSQL `15` or newer with `pgcrypto` support.
* **In-Memory Cache:** Redis `7.0` or newer.
* **Process Manager:** `pm2` (`npm install -g pm2`).
* **Web Server:** Nginx `1.24+` with Certbot for automated TLS provisioning.

---

## 3. Automated 1-Command Installer & Web Wizard

The repository includes an automated installation script (`install.sh`) and an interactive browser-based setup wizard (`interactive-setup.html`) that configures the entire stack automatically.

### 3.1 One-Command Linux Installer
Run the installer with root privileges, supplying your domain names:
```bash
sudo bash install.sh \
  --frontend-domain "ui.yourdomain.com" \
  --backend-domain "ocpp.yourdomain.com" \
  -y
```

The automated installer executes the following operations:
1. Installs Node.js 24.x, PostgreSQL 16, Redis 7, Nginx, Certbot, and PM2.
2. Creates the PostgreSQL database (`ocpp_cpms`) and dedicated database user.
3. Configures backend `.env` and frontend `.env.local` files.
4. Generates Prisma client types and pushes database schema migrations.
5. Seeds initial configuration profiles and superadmin credentials.
6. Builds the Next.js production frontend.
7. Deploys Nginx virtual hosts with WSS proxy forwarding and Let's Encrypt certificates.
8. Configures PM2 process daemons with automatic systemd startup.

### 3.2 Interactive Web Wizard (`interactive-setup.html`)
Open `interactive-setup.html` in any web browser to customize domains, database credentials, SMTP settings, Stripe/Mollie keys, and download a tailored bash script.

---

## 4. Step-by-Step Local Development Setup

To run the platform locally for development and testing:

### Step 4.1: Clone the Repository
```bash
git clone https://github.com/webdotpulse/GRID-OCPP-CPMS.git
cd GRID-OCPP-CPMS
```

### Step 4.2: Setup Backend
```bash
cd Backend
npm install

# Configure local environment variables
cp .env.example .env

# Generate Prisma Client & push schema to local PostgreSQL
npx prisma generate
npx prisma db push --accept-data-loss

# Create initial Superadmin account
npm run create-superadmin -- "superadmin@mobilitypulse.com" "AdminPassword123!"

# Start Backend development server (with tsx watch)
npm run dev
```
* Backend API is now active at `http://localhost:3000`
* OCPP WebSocket engine is listening on `ws://localhost:9220`

### Step 4.3: Setup Frontend
```bash
cd ../Frontend
npm install

# Create environment configuration
cat <<EOT > .env.local
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
EOT

# Start Next.js development server
npm run dev
```
* Dashboard UI is now available at `http://localhost:3002`

---

## 5. Production Server Provisioning (Ubuntu 24.04 LTS)

### Step 5.1: System Updates & Base Tools
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget build-essential ufw software-properties-common certbot python3-certbot-nginx
```

### Step 5.2: Node.js 24 LTS & PM2 Installation
```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

---

## 6. PostgreSQL Database & Prisma ORM Configuration

### Step 6.1: Install and Secure PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Step 6.2: Create Database & Role
```bash
sudo -u postgres psql <<EOF
CREATE DATABASE ocpp_cpms;
CREATE USER cpms_user WITH ENCRYPTED PASSWORD 'StrongSecureDatabasePassword456!';
GRANT ALL PRIVILEGES ON DATABASE ocpp_cpms TO cpms_user;
ALTER DATABASE ocpp_cpms OWNER TO cpms_user;
\c ocpp_cpms
GRANT ALL ON SCHEMA public TO cpms_user;
EOF
```

### Step 6.3: Prisma Database Migration
In `Backend/.env`, specify the connection URI:
```env
DATABASE_URL="postgresql://cpms_user:StrongSecureDatabasePassword456!@localhost:5432/ocpp_cpms?schema=public"
```
Execute schema synchronization:
```bash
cd Backend
npx prisma generate
npx prisma db push --accept-data-loss
```

---

## 7. Redis Caching & BullMQ Queue Configuration

### Step 7.1: Install Redis Server
```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### Step 7.2: Verify Redis Connectivity
```bash
redis-cli ping
# Expected response: PONG
```

---

## 8. Backend API & OCPP WebSocket Engine Deployment

```bash
cd /var/www/ocpp-cpms/Backend
npm install --production=false
npx prisma generate
npx tsc

# Create the initial Superadmin user
npm run create-superadmin -- "admin@mobilitypulse.com" "SuperSecret2026!"
```

---

## 9. Frontend Next.js Admin Dashboard Deployment

```bash
cd /var/www/ocpp-cpms/Frontend
npm install

cat <<EOT > .env.local
NEXT_PUBLIC_API_URL="https://ocpp.yourdomain.com/api"
EOT

# Build optimized production bundle
npm run build
```

---

## 10. Nginx Reverse Proxy, TLS Certificates & WSS Routing

Create the Nginx configuration file at `/etc/nginx/sites-available/ocpp-cpms`:

```nginx
# 1. Frontend Next.js Admin Dashboard (ui.yourdomain.com)
server {
    server_name ui.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 2. Backend REST API & OCPP WebSockets (ocpp.yourdomain.com)
server {
    server_name ocpp.yourdomain.com;

    # REST API & Roaming Endpoints
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Live Real-Time Socket.IO Stream
    location /api/realtime/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # OCPP 1.6-J and 2.0.1/2.1 WebSocket Server
    location ~ ^/OCPP/(1\.6|2\.1|2\.0\.1)/ {
        proxy_pass http://127.0.0.1:9220;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }
}
```

Enable the site and obtain SSL certificates:
```bash
sudo ln -s /etc/nginx/sites-available/ocpp-cpms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Automate SSL with Let's Encrypt
sudo certbot --nginx -d ui.yourdomain.com -d ocpp.yourdomain.com --non-interactive --agree-tos -m admin@yourdomain.com
```

---

## 11. PM2 Process Management & Systemd Automation

The repository includes `ecosystem.config.cjs` configured for production:

```javascript
module.exports = {
  apps: [
    {
      name: "ocpp-backend",
      cwd: "./Backend",
      script: "dist/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        OCPP_PORT: 9220
      }
    },
    {
      name: "ocpp-frontend",
      cwd: "./Frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3002",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3002
      }
    }
  ]
};
```

Start the ecosystem and configure system startup:
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd
```

---

## 12. Firewall & Network Security (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw enable
```

---

## 13. Environment Configuration Reference (.env)

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Node environment (`development` / `production`). |
| `PORT` | `3000` | REST API HTTP port. |
| `OCPP_PORT` | `9220` | Native OCPP WebSocket engine port. |
| `DATABASE_URL` | `postgresql://user:pwd@localhost:5432/ocpp_cpms` | PostgreSQL connection string. |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection URL. |
| `JWT_SECRET` | `long_random_hex_key` | Secret key for signing JWT tokens. |
| `JWT_EXPIRY` | `7d` | Token validity duration. |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe payment gateway secret key. |
| `MOLLIE_API_KEY` | `live_...` | Mollie European payment gateway key. |
| `EPEX_SPOT_API_KEY`| `key_...` | EnergyZero / ENTSO-E dynamic tariff API key. |
| `SMTP_HOST` | `smtp.postmarkapp.com` | Outgoing transactional email host. |
| `SMTP_PORT` | `587` | Outgoing SMTP port. |
| `SMTP_USER` | `api_token` | SMTP authentication user. |
| `SMTP_PASS` | `password` | SMTP authentication password. |

---

## 14. Connecting Physical Chargers & Straight-Through Proxy

Configure your EVSE hardware firmware to point to the secure WebSocket endpoint:

### Standard Connection
* **OCPP 1.6-J:** `wss://ocpp.yourdomain.com/OCPP/1.6/<chargerId>`
* **OCPP 2.0.1 / 2.1:** `wss://ocpp.yourdomain.com/OCPP/2.1/<chargerId>`

### Straight-Through Proxy Forwarding
If the CPMS acts as an intermediary proxy forwarding traffic to an external upstream operator:
1. Open the charger record in the Admin Dashboard (`/chargers/[id]/edit`).
2. Toggle **Enable Straight-Through Proxy**.
3. Input the **Target Upstream WebSocket URL** (e.g., `wss://external-cpo.com/ocpp16`).
4. Select card pass-through rules and save.

---

## 15. Health Checks, Monitoring & Troubleshooting

### 15.1 System Health Checks
* **REST API Health:** `curl https://ocpp.yourdomain.com/health` (Returns `{"status":"ok","database":"connected","redis":"connected"}`)
* **PM2 Process Status:** `pm2 status`
* **Real-time PM2 Logs:** `pm2 logs ocpp-backend`

### 15.2 Common Troubleshooting Scenarios

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **Charger Stuck in "Offline"** | WebSocket URL misconfigured or TLS certificate rejected. | Verify charger can resolve DNS and supports Let's Encrypt CA root. |
| **HTTP 502 Bad Gateway** | PM2 backend or frontend process is stopped. | Check `pm2 status` and inspect `pm2 logs ocpp-backend`. |
| **Database Connection Refused** | PostgreSQL service stopped or credentials invalid. | Verify `sudo systemctl status postgresql` and test `DATABASE_URL` with `psql`. |
| **Redis Connection Timeout** | Redis daemon inactive. | Run `sudo systemctl restart redis-server` and verify with `redis-cli ping`. |

---
*Authored for Enterprise Operators & DevOps Teams — webdotpulse/GRID-OCPP-CPMS.*
