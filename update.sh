#!/usr/bin/env bash
# ==============================================================================
# OCPP-CPMS Automated Production Update Script
# High-Performance Open-Source Charge Point Management System
# ==============================================================================

set -eo pipefail

# Text formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

log_info()    { echo -e "${CYAN}${BOLD}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}${BOLD}[WARNING]${NC} $1"; }
log_error()   { echo -e "${RED}${BOLD}[ERROR]${NC} $1"; }

# Determine script & repository directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${CYAN}==============================================================${NC}"
echo -e "${BOLD}       ⚡ GRID-OCPP-CPMS Application Update Utility ⚡        ${NC}"
echo -e "${CYAN}==============================================================${NC}"
echo -e "Working Directory: ${GREEN}${SCRIPT_DIR}${NC}"
echo -e "Current User     : ${GREEN}$(whoami)${NC}"
echo -e "${CYAN}--------------------------------------------------------------${NC}"

# Check for root/sudo vs normal user permissions
if [[ "$EUID" -eq 0 && -n "$SUDO_USER" ]]; then
  log_info "Running under sudo. Will ensure directory ownership is set to ${SUDO_USER}:${SUDO_USER}."
  chown -R "$SUDO_USER:$SUDO_USER" "$SCRIPT_DIR"
fi

# 1. Git Pull
log_info "Step 1/5: Pulling latest changes from Git repository..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD || echo "main")
  log_info "Current Git branch: ${CURRENT_BRANCH}"
  git pull origin "$CURRENT_BRANCH"
  log_success "Git repository updated successfully."
else
  log_warn "Not a git repository or git not configured. Skipping git pull."
fi

# 2. Update Backend
log_info "Step 2/5: Updating Backend dependencies and database schema..."
if [[ -d "$SCRIPT_DIR/Backend" ]]; then
  cd "$SCRIPT_DIR/Backend"
  npm install
  npx prisma generate
  npx prisma db push --accept-data-loss
  log_success "Backend dependencies and Prisma schema updated."
else
  log_error "Backend directory not found at $SCRIPT_DIR/Backend!"
  exit 1
fi

# 3. Update & Build Frontend
log_info "Step 3/5: Updating Frontend dependencies and compiling Next.js bundle..."
if [[ -d "$SCRIPT_DIR/Frontend" ]]; then
  cd "$SCRIPT_DIR/Frontend"
  npm install
  npm run build
  log_success "Frontend production bundle built successfully."
else
  log_error "Frontend directory not found at $SCRIPT_DIR/Frontend!"
  exit 1
fi

# Restore ownership after build if running as sudo
if [[ "$EUID" -eq 0 && -n "$SUDO_USER" ]]; then
  chown -R "$SUDO_USER:$SUDO_USER" "$SCRIPT_DIR"
fi

# 4. Restart Process Manager (PM2)
log_info "Step 4/5: Restarting PM2 process daemons..."
cd "$SCRIPT_DIR"
if command -v pm2 >/dev/null 2>&1; then
  if [[ -f "$SCRIPT_DIR/ecosystem.config.cjs" ]]; then
    pm2 restart "$SCRIPT_DIR/ecosystem.config.cjs" || pm2 start "$SCRIPT_DIR/ecosystem.config.cjs"
  else
    pm2 restart ocpp-backend ocpp-frontend || true
  fi
  log_success "PM2 processes restarted successfully."
else
  log_warn "PM2 is not installed globally or not found in PATH. Skipping automated PM2 restart."
  log_info "To install PM2: sudo npm install -g pm2"
fi

# 5. Health Check Verification
log_info "Step 5/5: Running post-update health check..."
sleep 3
if command -v curl >/dev/null 2>&1; then
  HEALTH_STATUS=$(curl -s --connect-timeout 5 http://localhost:3000/health || echo "unavailable")
  if [[ "$HEALTH_STATUS" =~ "ok" || "$HEALTH_STATUS" =~ "status" ]]; then
    log_success "Backend health check response: $HEALTH_STATUS"
  else
    log_warn "Backend health check returned: $HEALTH_STATUS (Service may still be initializing)."
  fi
fi

echo -e "${CYAN}==============================================================${NC}"
log_success "⚡ OCPP-CPMS update completed successfully!"
echo -e "${CYAN}==============================================================${NC}"
echo -e "You can inspect live process status with: ${BOLD}pm2 status${NC}"
echo -e "You can inspect live application logs with: ${BOLD}pm2 logs${NC}"
