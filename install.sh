#!/usr/bin/env bash
# ==============================================================================
# OCPP-CPMS Enterprise Production Installer
# High-Performance Open-Source Charge Point Management System
# Supported OS: Ubuntu 22.04 / 24.04 LTS, Debian 12
# ==============================================================================

set -eo pipefail

# Text formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

log_info() { echo -e "${CYAN}${BOLD}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}${BOLD}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}${BOLD}[ERROR]${NC} $1"; }

# Default configuration variables
FRONTEND_DOMAIN="ui.mobilitypulse.com"
BACKEND_DOMAIN="ocpp.mobilitypulse.com"
VM_IP=""
DB_NAME="ocpp_cms"
DB_USER="cms_user"
DB_PASS=""
JWT_SECRET=""
ADMIN_EMAIL="superadmin@mobilitypulse.com"
ADMIN_PASS=""
INSTALL_DIR="/var/www/ocpp-cms"
GIT_REPO="https://github.com/webdotpulse/GRID-OCPP-CPMS.git"
TIMEZONE="Europe/Brussels"
SKIP_SSL=false
NON_INTERACTIVE=false

# Generate secure random strings
generate_random_pass() {
  openssl rand -base64 16 | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c 16
}

generate_random_secret() {
  openssl rand -hex 32
}

# Print help banner
show_help() {
  cat <<EOF
${BOLD}OCPP-CPMS Automated Installer${NC}

Usage: sudo bash install.sh [OPTIONS]

Options:
  --frontend-domain <domain>    Domain for Next.js Frontend Dashboard (default: ui.mobilitypulse.com)
  --backend-domain <domain>     Domain for Express API & OCPP WebSockets (default: ocpp.mobilitypulse.com)
  --db-name <name>              PostgreSQL Database name (default: ocpp_cms)
  --db-user <user>              PostgreSQL Database user (default: cms_user)
  --db-pass <password>          PostgreSQL Password (auto-generated if omitted)
  --jwt-secret <secret>         JWT Secret 64-char Hex (auto-generated if omitted)
  --admin-email <email>         Initial Superadmin Email (default: superadmin@mobilitypulse.com)
  --admin-pass <password>       Initial Superadmin Password (auto-generated if omitted)
  --install-dir <path>          Installation directory (default: /var/www/ocpp-cms)
  --git-repo <url>              Git repository URL (default: official repo)
  --timezone <tz>               Server timezone (default: Europe/Brussels)
  --skip-ssl                    Skip Certbot Let's Encrypt SSL setup
  -y, --non-interactive         Run unattended without confirmation prompts
  -h, --help                    Show this help message

Example:
  sudo bash install.sh \\
    --frontend-domain "ui.example.com" \\
    --backend-domain "ocpp.example.com" \\
    --admin-email "admin@example.com" \\
    --admin-pass "SuperSecurePass123!" \\
    -y
EOF
  exit 0
}

# Parse command-line arguments
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --frontend-domain) FRONTEND_DOMAIN="$2"; shift 2 ;;
    --backend-domain) BACKEND_DOMAIN="$2"; shift 2 ;;
    --vm-ip) VM_IP="$2"; shift 2 ;;
    --db-name) DB_NAME="$2"; shift 2 ;;
    --db-user) DB_USER="$2"; shift 2 ;;
    --db-pass) DB_PASS="$2"; shift 2 ;;
    --jwt-secret) JWT_SECRET="$2"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-pass) ADMIN_PASS="$2"; shift 2 ;;
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --git-repo) GIT_REPO="$2"; shift 2 ;;
    --timezone) TIMEZONE="$2"; shift 2 ;;
    --skip-ssl) SKIP_SSL=true; shift 1 ;;
    -y|--non-interactive) NON_INTERACTIVE=true; shift 1 ;;
    -h|--help) show_help ;;
    *) log_error "Unknown parameter: $1"; show_help ;;
  esac
done

# Root check
if [[ $EUID -ne 0 ]]; then
  log_error "This script must be run as root. Please run with 'sudo bash install.sh'."
  exit 1
fi

# Detect Server IP if empty
if [[ -z "$VM_IP" ]]; then
  VM_IP=$(curl -s --connect-timeout 3 https://ifconfig.me || curl -s --connect-timeout 3 https://api.ipify.org || echo "127.0.0.1")
fi

# Generate credentials if empty
if [[ -z "$DB_PASS" ]]; then DB_PASS=$(generate_random_pass); fi
if [[ -z "$JWT_SECRET" ]]; then JWT_SECRET=$(generate_random_secret); fi
if [[ -z "$ADMIN_PASS" ]]; then ADMIN_PASS=$(generate_random_pass); fi

# Interactive confirmation if not non-interactive
if [[ "$NON_INTERACTIVE" != true ]]; then
  echo -e "${CYAN}==============================================================${NC}"
  echo -e "${BOLD}           ⚡ OCPP-CPMS Installation Wizard ⚡                ${NC}"
  echo -e "${CYAN}==============================================================${NC}"
  echo -e "Frontend Domain : ${GREEN}${FRONTEND_DOMAIN}${NC}"
  echo -e "Backend Domain  : ${GREEN}${BACKEND_DOMAIN}${NC}"
  echo -e "Server IP       : ${GREEN}${VM_IP}${NC}"
  echo -e "Database User   : ${GREEN}${DB_USER}${NC}"
  echo -e "Database Name   : ${GREEN}${DB_NAME}${NC}"
  echo -e "Database Pass   : ${YELLOW}${DB_PASS}${NC}"
  echo -e "Superadmin Email: ${GREEN}${ADMIN_EMAIL}${NC}"
  echo -e "Superadmin Pass : ${YELLOW}${ADMIN_PASS}${NC}"
  echo -e "Install Directory: ${GREEN}${INSTALL_DIR}${NC}"
  echo -e "Timezone        : ${GREEN}${TIMEZONE}${NC}"
  echo -e "SSL (Certbot)   : $([ "$SKIP_SSL" = true ] && echo -e "${YELLOW}Disabled${NC}" || echo -e "${GREEN}Enabled${NC}")"
  echo -e "${CYAN}--------------------------------------------------------------${NC}"
  read -rp "Proceed with installation? [y/N]: " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    log_warn "Installation cancelled by user."
    exit 0
  fi
fi

START_TIME=$(date +%s)

# 1. System Updates & Dependencies
log_info "Step 1/8: Updating package repository and installing base utilities..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl wget ufw build-essential openssl sed lsb-release ca-certificates gnupg

# Set System Timezone
timedatectl set-timezone "$TIMEZONE" || true

# 2. Configure UFW Firewall
log_info "Step 2/8: Configuring UFW firewall..."
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

# 3. Install Node.js 24 LTS & PM2
log_info "Step 3/8: Installing Node.js 24 LTS and PM2..."
if ! command -v node &>/dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 22 ]]; then
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
  NODE_MAJOR=24
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
fi

npm install -g pm2
pm2 install pm2-logrotate || true
pm2 set pm2-logrotate:max_size 50M || true
pm2 set pm2-logrotate:compress true || true
pm2 set pm2-logrotate:retain 14 || true

# 4. Install & Configure PostgreSQL and Redis
log_info "Step 4/8: Installing PostgreSQL and Redis..."
apt-get install -y postgresql postgresql-contrib redis-server nginx certbot python3-certbot-nginx

systemctl start postgresql
systemctl enable postgresql
systemctl start redis-server
systemctl enable redis-server

# Configure PostgreSQL User and Database
log_info "Configuring PostgreSQL database and user..."
sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'; END IF; END \$\$;"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "SELECT 'CREATE DATABASE ${DB_NAME}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET timezone TO '${TIMEZONE}';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

# 5. Clone/Update Application Repository
log_info "Step 5/8: Deploying application to ${INSTALL_DIR}..."
mkdir -p "$(dirname "$INSTALL_DIR")"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  log_info "Directory ${INSTALL_DIR} already exists. Fetching latest updates..."
  cd "$INSTALL_DIR"
  git fetch --all
  git reset --hard origin/main || git pull
else
  git clone "$GIT_REPO" "$INSTALL_DIR"
fi

# Detect actual sudo user or default to root
ACTUAL_USER="${SUDO_USER:-root}"
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$INSTALL_DIR"

# 6. Backend Setup & Build
log_info "Step 6/8: Setting up Backend (Prisma, Dependencies, Build)..."
cd "$INSTALL_DIR/Backend"

# Write Backend .env
cat <<EOT > .env
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
PORT=3000
OCPP_PORT=9220
OCPP_LOG_WS_PORT=3001
JWT_SECRET="${JWT_SECRET}"
REDIS_URL="redis://localhost:6379"
TZ="${TIMEZONE}"
LOG_LEVEL=info
DEFAULT_DYNAMIC_PROVIDER="EnergyZero"
DEFAULT_DYNAMIC_COUNTRY="BE"
FRONTEND_URL="https://${FRONTEND_DOMAIN}"
ALLOWED_ORIGINS="https://${FRONTEND_DOMAIN},http://${FRONTEND_DOMAIN},https://*.${FRONTEND_DOMAIN#*.},http://localhost:3002"
EOT

npm install
npx prisma generate
npx prisma db push --accept-data-loss
npm run build || true

# Provision Superadmin User
log_info "Provisioning Superadmin Account: ${ADMIN_EMAIL}..."
npm run create-superadmin -- "${ADMIN_EMAIL}" "${ADMIN_PASS}"

# 7. Frontend Setup & Build
log_info "Step 7/8: Setting up Frontend Dashboard (Next.js Build)..."
cd "$INSTALL_DIR/Frontend"

cat <<EOT > .env.production
NEXT_PUBLIC_API_URL="https://${BACKEND_DOMAIN}/api"
TZ="${TIMEZONE}"
EOT

cat <<EOT > .env.local
NEXT_PUBLIC_API_URL="https://${BACKEND_DOMAIN}/api"
TZ="${TIMEZONE}"
EOT

npm install
npm run build

# PM2 Setup
log_info "Starting services via PM2..."
cd "$INSTALL_DIR"

cat <<EOT > ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "ocpp-backend",
      cwd: "$INSTALL_DIR/Backend",
      script: "npm",
      args: "start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "ocpp-frontend",
      cwd: "$INSTALL_DIR/Frontend",
      script: "node_modules/.bin/next",
      args: "start -p 3002",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
EOT

pm2 delete ocpp-backend 2>/dev/null || true
pm2 delete ocpp-frontend 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save --force
pm2 startup systemd -u "$ACTUAL_USER" --hp "/home/$ACTUAL_USER" 2>/dev/null || pm2 startup systemd || true

# 8. Nginx Reverse Proxy Configuration
log_info "Step 8/8: Configuring Nginx Reverse Proxy & SSL..."

cat <<EOT > /etc/nginx/sites-available/ocpp-cpms.conf
# ==============================================================================
# OCPP-CPMS Nginx Configuration
# ==============================================================================

# 1. Frontend Dashboard UI
server {
    listen 80;
    server_name ${FRONTEND_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# 2. Backend REST API, Socket.IO & OCPP WebSockets
server {
    listen 80;
    server_name ${BACKEND_DOMAIN};

    client_max_body_size 50M;

    # REST API Routing
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    # Real-time Socket.IO Events Stream
    location /api/realtime/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Live Log Stream WebSocket (Port 3001)
    location /api/ocpp/logs {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # OCPP 1.6-J and 2.0.1/2.1 WebSocket Server (Port 9220)
    location /OCPP/ {
        proxy_pass http://127.0.0.1:9220/OCPP/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOT

ln -sf /etc/nginx/sites-available/ocpp-cpms.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t
systemctl restart nginx

# SSL Certificate Provisioning
if [[ "$SKIP_SSL" != true ]]; then
  log_info "Obtaining Let's Encrypt SSL Certificates via Certbot..."
  certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email \
    -d "${FRONTEND_DOMAIN}" -d "${BACKEND_DOMAIN}" || {
      log_warn "Certbot automated SSL provisioning encountered an issue."
      log_warn "Ensure DNS A Records for ${FRONTEND_DOMAIN} and ${BACKEND_DOMAIN} point to ${VM_IP}."
      log_warn "You can run 'sudo certbot --nginx -d ${FRONTEND_DOMAIN} -d ${BACKEND_DOMAIN}' later once DNS resolves."
    }
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Completion Banner
echo -e ""
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD}   ⚡ OCPP-CPMS Installation Completed Successfully in ${DURATION} seconds! ⚡   ${NC}"
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e ""
echo -e "  ${BOLD}🖥️ Frontend Dashboard UI:${NC}    https://${FRONTEND_DOMAIN}"
echo -e "  ${BOLD}🔌 Backend REST API:${NC}         https://${BACKEND_DOMAIN}/api"
echo -e "  ${BOLD}⚡ OCPP 1.6 WebSocket:${NC}       wss://${BACKEND_DOMAIN}/OCPP/1.6/{chargerId}"
echo -e "  ${BOLD}⚡ OCPP 2.1 WebSocket:${NC}       wss://${BACKEND_DOMAIN}/OCPP/2.1/{chargerId}"
echo -e ""
echo -e "  ${BOLD}🔐 Superadmin Credentials:${NC}"
echo -e "     Email:    ${GREEN}${ADMIN_EMAIL}${NC}"
echo -e "     Password: ${YELLOW}${ADMIN_PASS}${NC}"
echo -e ""
echo -e "  ${BOLD}🗄️ PostgreSQL Database:${NC}"
echo -e "     Database: ${DB_NAME}"
echo -e "     User:     ${DB_USER}"
echo -e "     Password: ${DB_PASS}"
echo -e ""
echo -e "  ${BOLD}🛠️ Useful Commands:${NC}"
echo -e "     View Process Status:  pm2 status"
echo -e "     View Live Logs:       pm2 logs"
echo -e "     Restart All Services: pm2 restart all"
echo -e "     Nginx Logs:           sudo tail -f /var/log/nginx/error.log"
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e ""
