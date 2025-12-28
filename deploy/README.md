# Dogbook Deployment Files

This directory contains all files needed for deploying dogbook backend to production.

## Files

- **post-receive**: Git hook that runs after `git push deploy main`
- **dogbook.service**: Systemd service for running the backend
- **dogbook-backup.service**: Systemd service for backing up SQLite database
- **dogbook-backup.timer**: Systemd timer that runs backup daily

## Server Setup

See main README.md for deployment instructions.

## Deployment Workflow

After initial setup, deploying is as simple as:

```bash
git push deploy main
```

This will:
1. Checkout latest code to `/srv/dogbook/current`
2. Install npm dependencies
3. Build the backend
4. Restart the systemd service

## Backup Strategy

### Local Backups (Legacy)

- Daily SQLite database backups at `/srv/dogbook/backups/`
- Keeps last 30 days of backups
- Run by `dogbook-backup.timer`

### R2 Cloud Backups (Recommended)

Full backup of database AND images to Cloudflare R2 with tiered retention:

- **Daily backups**: kept for 7 days
- **Weekly backups** (Sundays): kept for 12 weeks (~3 months)
- **Monthly backups** (1st of month): kept for 12 months (1 year)
- **Images**: synced incrementally (no duplicates - only uploads new/changed files)

**Files:**
- `r2-backup.sh` - Main backup script
- `r2-restore.sh` - Restore from backup
- `setup-r2-backup.sh` - One-time setup script
- `dogbook-r2-backup.service` - Systemd service
- `dogbook-r2-backup.timer` - Runs daily at 3 AM

**Setup R2 Backups:**

```bash
# Run the setup script (configures rclone and installs timer)
sudo ./deploy/setup-r2-backup.sh
```

You'll need:
1. Cloudflare R2 bucket created
2. R2 API token with read/write access
3. Account ID (from dashboard URL)

**Manual Commands:**

```bash
# Check backup status
systemctl status dogbook-r2-backup.timer

# Manually trigger a backup
sudo systemctl start dogbook-r2-backup.service

# View backup logs
journalctl -u dogbook-r2-backup.service

# List all backups
sudo -u dogbook /srv/dogbook/deploy/r2-backup.sh list
```

**Restore from Backup:**

```bash
# List available backups
sudo /srv/dogbook/deploy/r2-restore.sh list

# Restore latest database backup
sudo /srv/dogbook/deploy/r2-restore.sh latest

# Restore database from specific date
sudo /srv/dogbook/deploy/r2-restore.sh db 2024-01-15

# Restore images
sudo /srv/dogbook/deploy/r2-restore.sh images

# Full restore (database + images)
sudo /srv/dogbook/deploy/r2-restore.sh all
```

**Estimated Storage Usage:**
- Database: ~30-90 MB (31 copies with tiered retention)
- Images: ~300 MB - 1.5 GB (stored once, synced incrementally)
- Total: ~400 MB - 2 GB initially, growing with usage
