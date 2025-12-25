#!/bin/bash
# Standalone deploy script for dogbook
# Can be called directly via SSH or from post-receive hook

set -e

# Prevent concurrent deploys
LOCKFILE="/tmp/dogbook-deploy.lock"
exec 200>"$LOCKFILE"
flock -n 200 || { echo "Deploy already in progress"; exit 1; }

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

TARGET="/srv/dogbook/current"
GIT_DIR="/srv/dogbook/repo.git"
BRANCH="main"

echo "======================================"
echo "Deploying dogbook backend to production"
echo "======================================"

# Fetch latest and checkout
echo "→ Fetching latest code..."
cd $TARGET
git --git-dir=$GIT_DIR --work-tree=$TARGET fetch origin $BRANCH
git --git-dir=$GIT_DIR --work-tree=$TARGET checkout -f $BRANCH
git --git-dir=$GIT_DIR --work-tree=$TARGET reset --hard origin/$BRANCH

# Navigate to backend directory
cd $TARGET/backend

# Install dependencies (skip postinstall to avoid schema check)
echo "→ Installing dependencies..."
npm install --production --ignore-scripts

# Fix Prisma binary targets for production server
echo "→ Updating Prisma binary targets..."
sed -i 's/provider = "prisma-client-js"/provider = "prisma-client-js"\n  binaryTargets = ["native", "debian-openssl-3.0.x"]/' schema.prisma

# Generate Prisma client
echo "→ Generating Prisma client..."
npx prisma generate

# Stop service before migrations (SQLite locks)
echo "→ Stopping service for migrations..."
sudo systemctl stop dogbook || true

# Run database migrations
echo "→ Running database migrations..."
npx prisma migrate deploy

# Build backend
echo "→ Building backend..."
npm run build

# Ensure data symlink exists
if [ ! -L "$TARGET/data" ]; then
    echo "→ Creating data symlink..."
    ln -s /srv/dogbook/data $TARGET/data
fi

# Restart systemd service
echo "→ Restarting dogbook service..."
if sudo systemctl restart dogbook 2>&1; then
    echo "✓ Service restarted successfully"
else
    echo "⚠ Warning: Failed to restart service (exit code: $?)"
    echo "  You may need to restart manually: sudo systemctl restart dogbook"
fi

echo "======================================"
echo "✓ Deployment complete!"
echo "======================================"
