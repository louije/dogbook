#!/bin/bash
# R2 Restore Script for Dogbook
# Restores database and/or images from Cloudflare R2 backups
#
# Usage:
#   ./r2-restore.sh latest              # Restore latest database backup
#   ./r2-restore.sh db 2024-01-15       # Restore database from specific date
#   ./r2-restore.sh images              # Restore all images
#   ./r2-restore.sh all                 # Restore both database (latest) and images
#   ./r2-restore.sh list                # List available backups

set -euo pipefail

# Configuration
DATA_DIR="/srv/dogbook/data"
DB_FILE="$DATA_DIR/keystone.db"
IMAGES_DIR="$DATA_DIR/images"
TMP_DIR="/tmp/dogbook-restore"
R2_BUCKET="maisonsdoggo"
SERVICE_NAME="dogbook"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

confirm() {
    local prompt="$1"
    read -p "$prompt [y/N] " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Check prerequisites
check_prerequisites() {
    if ! command -v rclone &> /dev/null; then
        error "rclone is not installed"
        exit 1
    fi

    if ! rclone listremotes | grep -q "^r2:$"; then
        error "rclone remote 'r2' is not configured"
        exit 1
    fi
}

# Stop the service before restore
stop_service() {
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        log "Stopping $SERVICE_NAME service..."
        sudo systemctl stop "$SERVICE_NAME"
        return 0
    fi
    return 1
}

# Start the service after restore
start_service() {
    log "Starting $SERVICE_NAME service..."
    sudo systemctl start "$SERVICE_NAME"
}

# List available backups
list_backups() {
    log "Available backups in R2:"
    echo ""

    echo "=== Latest (quick restore) ==="
    rclone ls "r2:$R2_BUCKET/latest/" 2>/dev/null || echo "(none)"
    echo ""

    echo "=== Daily Backups (last 7 days) ==="
    rclone ls "r2:$R2_BUCKET/db/daily/" 2>/dev/null | sort -r || echo "(none)"
    echo ""

    echo "=== Weekly Backups (last 12 weeks) ==="
    rclone ls "r2:$R2_BUCKET/db/weekly/" 2>/dev/null | sort -r || echo "(none)"
    echo ""

    echo "=== Monthly Backups (last 12 months) ==="
    rclone ls "r2:$R2_BUCKET/db/monthly/" 2>/dev/null | sort -r || echo "(none)"
    echo ""

    echo "=== Images ==="
    local image_count=$(rclone ls "r2:$R2_BUCKET/images/" 2>/dev/null | wc -l)
    local image_size=$(rclone size "r2:$R2_BUCKET/images/" 2>/dev/null | grep "Total size" | awk '{print $3, $4}')
    echo "Files: $image_count, Size: ${image_size:-0}"
}

# Find a backup file by date
find_backup() {
    local date="$1"
    local backup_file=""

    # Try daily first
    backup_file="db/daily/keystone-$date.db.gz"
    if rclone ls "r2:$R2_BUCKET/$backup_file" &>/dev/null; then
        echo "$backup_file"
        return 0
    fi

    # Try weekly
    backup_file="db/weekly/keystone-$date.db.gz"
    if rclone ls "r2:$R2_BUCKET/$backup_file" &>/dev/null; then
        echo "$backup_file"
        return 0
    fi

    # Try monthly
    backup_file="db/monthly/keystone-$date.db.gz"
    if rclone ls "r2:$R2_BUCKET/$backup_file" &>/dev/null; then
        echo "$backup_file"
        return 0
    fi

    return 1
}

# Restore database
restore_database() {
    local source="$1"
    local backup_path=""

    mkdir -p "$TMP_DIR"

    if [ "$source" = "latest" ]; then
        backup_path="latest/keystone.db.gz"
        log "Restoring latest database backup..."
    else
        # Source is a date (YYYY-MM-DD)
        backup_path=$(find_backup "$source") || {
            error "No backup found for date: $source"
            echo "Available backups:"
            list_backups
            exit 1
        }
        log "Restoring database from: $backup_path"
    fi

    # Download the backup
    local temp_file="$TMP_DIR/restore.db.gz"
    log "Downloading backup..."
    rclone copyto "r2:$R2_BUCKET/$backup_path" "$temp_file"

    # Decompress
    log "Decompressing..."
    gunzip -f "$temp_file"
    local restored_db="$TMP_DIR/restore.db"

    # Verify the database integrity
    log "Verifying database integrity..."
    if ! sqlite3 "$restored_db" "PRAGMA integrity_check;" | grep -q "ok"; then
        error "Database integrity check failed!"
        rm -f "$restored_db"
        exit 1
    fi

    # Create backup of current database
    if [ -f "$DB_FILE" ]; then
        local current_backup="$DB_FILE.before-restore-$(date +%Y%m%d-%H%M%S)"
        log "Backing up current database to: $current_backup"
        cp "$DB_FILE" "$current_backup"
    fi

    # Stop service, restore, start service
    local was_running=false
    if stop_service; then
        was_running=true
    fi

    log "Restoring database..."
    mkdir -p "$(dirname "$DB_FILE")"
    cp "$restored_db" "$DB_FILE"

    # Set correct ownership (assuming dogbook user)
    if id "dogbook" &>/dev/null; then
        chown dogbook:dogbook "$DB_FILE"
    fi

    if [ "$was_running" = true ]; then
        start_service
    fi

    # Clean up
    rm -f "$restored_db"

    log "Database restored successfully!"
    log "Previous database backed up to: ${current_backup:-N/A}"
}

# Restore images
restore_images() {
    log "Restoring images from R2..."

    if ! confirm "This will sync all images from R2. Continue?"; then
        log "Aborted."
        exit 0
    fi

    mkdir -p "$IMAGES_DIR"

    # Use rclone sync to restore images
    rclone sync "r2:$R2_BUCKET/images/" "$IMAGES_DIR" \
        --checksum \
        --transfers 4 \
        --progress

    # Set correct ownership
    if id "dogbook" &>/dev/null; then
        chown -R dogbook:dogbook "$IMAGES_DIR"
    fi

    log "Images restored successfully!"
}

# Print usage
usage() {
    echo "Dogbook R2 Restore Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list                  List available backups"
    echo "  latest                Restore the latest database backup"
    echo "  db <YYYY-MM-DD>       Restore database from a specific date"
    echo "  images                Restore all images from R2"
    echo "  all                   Restore both database (latest) and images"
    echo ""
    echo "Examples:"
    echo "  $0 list               # See what backups are available"
    echo "  $0 latest             # Quick restore from latest backup"
    echo "  $0 db 2024-01-15      # Restore from January 15, 2024"
    echo "  $0 images             # Restore all images"
    echo "  $0 all                # Full restore (database + images)"
    echo ""
    echo "Notes:"
    echo "  - The service will be stopped during database restore"
    echo "  - Current database is backed up before restoration"
    echo "  - Images are synced (existing files not deleted unless missing from backup)"
}

# Main execution
main() {
    local command="${1:-}"
    local arg="${2:-}"

    case "$command" in
        list)
            check_prerequisites
            list_backups
            ;;
        latest)
            check_prerequisites
            if ! confirm "Restore latest database backup?"; then
                log "Aborted."
                exit 0
            fi
            restore_database "latest"
            ;;
        db)
            if [ -z "$arg" ]; then
                error "Please specify a date (YYYY-MM-DD)"
                usage
                exit 1
            fi
            check_prerequisites
            if ! confirm "Restore database from $arg?"; then
                log "Aborted."
                exit 0
            fi
            restore_database "$arg"
            ;;
        images)
            check_prerequisites
            restore_images
            ;;
        all)
            check_prerequisites
            if ! confirm "Restore database (latest) and all images?"; then
                log "Aborted."
                exit 0
            fi
            restore_database "latest"
            restore_images
            ;;
        help|--help|-h)
            usage
            ;;
        "")
            usage
            exit 1
            ;;
        *)
            error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

main "$@"
