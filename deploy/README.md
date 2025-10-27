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

- Daily SQLite database backups at `/srv/dogbook/backups/`
- Keeps last 30 days of backups
- Images are NOT backed up (stored in `/srv/dogbook/data/images/`)
