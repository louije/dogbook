#!/bin/bash

# Script to build the frontend
# This can be called manually or via a webhook

set -e

echo "Building frontend..."

cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build the site
echo "Running 11ty build..."
npm run build

echo "Frontend build complete! Output in frontend/_site/"

# Optional: Deploy to a specific location
# Uncomment and modify as needed
# if [ -d "/var/www/dogbook" ]; then
#   echo "Deploying to /var/www/dogbook..."
#   rsync -av --delete _site/ /var/www/dogbook/
#   echo "Deployment complete!"
# fi
