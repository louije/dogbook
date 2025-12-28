#!/bin/bash
# Setup script for Dogbook R2 Backup
# Run this once to configure rclone and install the systemd timer

set -euo pipefail

log() {
    echo "[SETUP] $1"
}

error() {
    echo "[ERROR] $1" >&2
}

# Check if running as root (needed for systemd)
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (sudo)"
    exit 1
fi

DEPLOY_DIR="/srv/dogbook/deploy"
DOGBOOK_USER="dogbook"

# Install rclone if not present
install_rclone() {
    if command -v rclone &> /dev/null; then
        log "rclone is already installed: $(rclone version | head -1)"
        return 0
    fi

    log "Installing rclone..."
    curl -s https://rclone.org/install.sh | bash
    log "rclone installed: $(rclone version | head -1)"
}

# Configure rclone for R2
configure_rclone() {
    local rclone_config="/home/$DOGBOOK_USER/.config/rclone/rclone.conf"

    if [ -f "$rclone_config" ] && grep -q "^\[r2\]$" "$rclone_config"; then
        log "rclone R2 remote already configured"
        return 0
    fi

    echo ""
    echo "=== Cloudflare R2 Configuration ==="
    echo ""
    echo "You'll need the following from your Cloudflare R2 dashboard:"
    echo "  1. Account ID (visible in the R2 dashboard URL)"
    echo "  2. Access Key ID (from R2 > Manage API tokens)"
    echo "  3. Secret Access Key (from R2 > Manage API tokens)"
    echo ""
    echo "The endpoint should be: https://<account-id>.r2.cloudflarestorage.com"
    echo ""

    read -p "Enter your R2 Account ID: " account_id
    read -p "Enter your R2 Access Key ID: " access_key
    read -sp "Enter your R2 Secret Access Key: " secret_key
    echo ""

    # Create config directory
    mkdir -p "/home/$DOGBOOK_USER/.config/rclone"

    # Create rclone config
    cat >> "$rclone_config" << EOF

[r2]
type = s3
provider = Cloudflare
access_key_id = $access_key
secret_access_key = $secret_key
endpoint = https://${account_id}.r2.cloudflarestorage.com
acl = private
EOF

    chown -R "$DOGBOOK_USER:$DOGBOOK_USER" "/home/$DOGBOOK_USER/.config"
    chmod 600 "$rclone_config"

    log "rclone R2 remote configured"

    # Test the connection
    log "Testing R2 connection..."
    if sudo -u "$DOGBOOK_USER" rclone lsd r2: &>/dev/null; then
        log "R2 connection successful!"
        sudo -u "$DOGBOOK_USER" rclone lsd r2:
    else
        error "R2 connection failed. Please check your credentials."
        exit 1
    fi
}

# Copy scripts to deploy directory
install_scripts() {
    log "Installing backup scripts..."

    # Copy scripts if running from repo
    if [ -f "$(dirname "$0")/r2-backup.sh" ]; then
        cp "$(dirname "$0")/r2-backup.sh" "$DEPLOY_DIR/"
        cp "$(dirname "$0")/r2-restore.sh" "$DEPLOY_DIR/"
    fi

    chmod +x "$DEPLOY_DIR/r2-backup.sh"
    chmod +x "$DEPLOY_DIR/r2-restore.sh"
    chown "$DOGBOOK_USER:$DOGBOOK_USER" "$DEPLOY_DIR/r2-backup.sh"
    chown "$DOGBOOK_USER:$DOGBOOK_USER" "$DEPLOY_DIR/r2-restore.sh"

    log "Scripts installed to $DEPLOY_DIR"
}

# Install systemd service and timer
install_systemd() {
    log "Installing systemd service and timer..."

    # Copy service files
    cp "$DEPLOY_DIR/dogbook-r2-backup.service" /etc/systemd/system/
    cp "$DEPLOY_DIR/dogbook-r2-backup.timer" /etc/systemd/system/

    # Reload systemd
    systemctl daemon-reload

    # Enable and start the timer
    systemctl enable dogbook-r2-backup.timer
    systemctl start dogbook-r2-backup.timer

    log "Systemd timer installed and started"
    echo ""
    systemctl status dogbook-r2-backup.timer --no-pager
}

# Run initial backup
run_initial_backup() {
    echo ""
    read -p "Run initial backup now? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Running initial backup..."
        sudo -u "$DOGBOOK_USER" "$DEPLOY_DIR/r2-backup.sh" backup
        log "Initial backup complete!"
    fi
}

# Main
main() {
    log "Setting up Dogbook R2 Backup"
    echo ""

    install_rclone
    configure_rclone
    install_scripts
    install_systemd
    run_initial_backup

    echo ""
    log "=== Setup Complete ==="
    echo ""
    echo "Useful commands:"
    echo "  # Check backup timer status"
    echo "  systemctl status dogbook-r2-backup.timer"
    echo ""
    echo "  # Manually trigger a backup"
    echo "  sudo systemctl start dogbook-r2-backup.service"
    echo ""
    echo "  # View backup logs"
    echo "  journalctl -u dogbook-r2-backup.service"
    echo ""
    echo "  # List backups"
    echo "  sudo -u $DOGBOOK_USER $DEPLOY_DIR/r2-backup.sh list"
    echo ""
    echo "  # Restore from backup"
    echo "  sudo $DEPLOY_DIR/r2-restore.sh latest"
    echo ""
}

main "$@"
