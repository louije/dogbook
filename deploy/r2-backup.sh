#!/bin/bash
# R2 Backup Script for Dogbook
# Backs up SQLite database and images to Cloudflare R2
#
# Retention policy:
#   - Daily backups: kept for 7 days
#   - Weekly backups (Sundays): kept for 3 months (~12 weeks)
#   - Monthly backups (1st of month): kept for 1 year (~12 months)
#
# Images are synced incrementally (no duplicates - only uploads new/changed files)

set -euo pipefail

# Load environment variables
ENV_FILE="/srv/dogbook/data/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# Configuration
DATA_DIR="/srv/dogbook/data"
DB_FILE="$DATA_DIR/keystone.db"
IMAGES_DIR="$DATA_DIR/images"
TMP_DIR="/tmp/dogbook-backup"
R2_BUCKET="${R2_BUCKET:-}"

# Validate required environment variables
if [ -z "$R2_BUCKET" ]; then
    echo "ERROR: R2_BUCKET environment variable is not set" >&2
    echo "Add R2_BUCKET=your-bucket-name to $ENV_FILE" >&2
    exit 1
fi

# Date calculations
TODAY=$(date +%Y-%m-%d)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

# Check prerequisites
check_prerequisites() {
    if ! command -v rclone &> /dev/null; then
        error "rclone is not installed. Install with: curl https://rclone.org/install.sh | sudo bash"
        exit 1
    fi

    if ! rclone listremotes | grep -q "^r2:$"; then
        error "rclone remote 'r2' is not configured. Run: rclone config"
        exit 1
    fi

    if [ ! -f "$DB_FILE" ]; then
        error "Database file not found: $DB_FILE"
        exit 1
    fi
}

# Create a safe SQLite backup using .backup command
backup_database() {
    log "Backing up SQLite database..."

    mkdir -p "$TMP_DIR"
    local backup_file="$TMP_DIR/keystone-$TODAY.db"
    local compressed_file="$backup_file.gz"

    # Use SQLite's .backup command for a consistent backup
    sqlite3 "$DB_FILE" ".backup '$backup_file'"

    # Compress the backup
    gzip -f "$backup_file"

    log "Database backup created: $compressed_file ($(du -h "$compressed_file" | cut -f1))"

    # Upload to daily folder
    log "Uploading daily backup..."
    rclone copyto "$compressed_file" "r2:$R2_BUCKET/db/daily/keystone-$TODAY.db.gz"

    # Also keep a 'latest' copy for easy restore
    rclone copyto "$compressed_file" "r2:$R2_BUCKET/latest/keystone.db.gz"

    # Weekly backup (Sunday)
    if [ "$DAY_OF_WEEK" -eq 7 ]; then
        log "Creating weekly backup (Sunday)..."
        rclone copyto "$compressed_file" "r2:$R2_BUCKET/db/weekly/keystone-$TODAY.db.gz"
    fi

    # Monthly backup (1st of month)
    if [ "$DAY_OF_MONTH" -eq "01" ]; then
        log "Creating monthly backup (1st of month)..."
        rclone copyto "$compressed_file" "r2:$R2_BUCKET/db/monthly/keystone-$TODAY.db.gz"
    fi

    # Clean up temp file
    rm -f "$compressed_file"
}

# Sync images to R2 (incremental - only uploads new/changed files)
sync_images() {
    if [ ! -d "$IMAGES_DIR" ]; then
        log "Images directory not found, skipping image sync"
        return
    fi

    log "Syncing images to R2 (incremental)..."

    # Use rclone sync with checksum to avoid re-uploading unchanged files
    # --checksum: Compare by checksum instead of mod-time/size (more reliable)
    # --progress: Show transfer progress
    rclone sync "$IMAGES_DIR" "r2:$R2_BUCKET/images/" \
        --checksum \
        --transfers 4 \
        --stats-one-line \
        -v

    log "Image sync complete"
}

# Apply retention policy - delete old backups
apply_retention() {
    log "Applying retention policy..."

    # Daily backups: keep last 7 days
    log "Cleaning daily backups (keeping last 7 days)..."
    rclone delete "r2:$R2_BUCKET/db/daily/" \
        --min-age 7d \
        -v 2>&1 | grep -v "^$" || true

    # Weekly backups: keep last ~12 weeks (90 days)
    log "Cleaning weekly backups (keeping last 12 weeks)..."
    rclone delete "r2:$R2_BUCKET/db/weekly/" \
        --min-age 90d \
        -v 2>&1 | grep -v "^$" || true

    # Monthly backups: keep last 12 months (365 days)
    log "Cleaning monthly backups (keeping last 12 months)..."
    rclone delete "r2:$R2_BUCKET/db/monthly/" \
        --min-age 365d \
        -v 2>&1 | grep -v "^$" || true

    log "Retention policy applied"
}

# List current backups
list_backups() {
    log "Current backups in R2:"
    echo ""
    echo "=== Daily Backups ==="
    rclone ls "r2:$R2_BUCKET/db/daily/" 2>/dev/null || echo "(none)"
    echo ""
    echo "=== Weekly Backups ==="
    rclone ls "r2:$R2_BUCKET/db/weekly/" 2>/dev/null || echo "(none)"
    echo ""
    echo "=== Monthly Backups ==="
    rclone ls "r2:$R2_BUCKET/db/monthly/" 2>/dev/null || echo "(none)"
    echo ""
    echo "=== Images ==="
    local image_count=$(rclone ls "r2:$R2_BUCKET/images/" 2>/dev/null | wc -l)
    local image_size=$(rclone size "r2:$R2_BUCKET/images/" 2>/dev/null | grep "Total size" | awk '{print $3, $4}')
    echo "Files: $image_count, Size: ${image_size:-0}"
}

# Main execution
main() {
    local action="${1:-backup}"

    case "$action" in
        backup)
            log "Starting Dogbook R2 backup..."
            check_prerequisites
            backup_database
            sync_images
            apply_retention
            log "Backup complete!"
            ;;
        list)
            check_prerequisites
            list_backups
            ;;
        *)
            echo "Usage: $0 [backup|list]"
            echo "  backup - Run full backup (default)"
            echo "  list   - List current backups"
            exit 1
            ;;
    esac
}

main "$@"
