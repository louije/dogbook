#!/bin/bash
# Standalone deploy script for dogbook
# Can be called directly via SSH (GitHub Actions) or from post-receive hook

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
GITHUB_REPO="https://github.com/louije/dogbook.git"

echo "======================================"
echo "Deploying dogbook backend to production"
echo "======================================"

# Fetch from GitHub (for GitHub Actions triggered deploys)
echo "→ Fetching from GitHub..."
git --git-dir=$GIT_DIR fetch $GITHUB_REPO $BRANCH:$BRANCH --force 2>/dev/null || true

# Checkout latest code
echo "→ Checking out latest code..."
cd $TARGET
git --git-dir=$GIT_DIR --work-tree=$TARGET checkout -f $BRANCH

# Navigate to backend directory
cd $TARGET/backend

# Install dependencies (skip postinstall to avoid schema check)
echo "→ Installing dependencies..."
npm install --production --ignore-scripts

# Generate Keystone schema.prisma
echo "→ Generating Keystone schema..."
npm run postinstall

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

# Ensure SESSION_SECRET is set in .env
ENV_FILE="/srv/dogbook/data/.env"
if [ -f "$ENV_FILE" ]; then
    if ! grep -q "^SESSION_SECRET=" "$ENV_FILE" || grep -q "^SESSION_SECRET=$" "$ENV_FILE" || grep -q "^SESSION_SECRET=CHANGE-ME" "$ENV_FILE"; then
        echo "→ Generating SESSION_SECRET..."
        NEW_SECRET=$(openssl rand -hex 32)
        if grep -q "^SESSION_SECRET=" "$ENV_FILE"; then
            sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$NEW_SECRET/" "$ENV_FILE"
        else
            echo "SESSION_SECRET=$NEW_SECRET" >> "$ENV_FILE"
        fi
        echo "✓ SESSION_SECRET generated"
    fi
else
    echo "⚠ Warning: $ENV_FILE not found. Create it from backend/.env.production.example"
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
