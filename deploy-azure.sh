#!/bin/bash
# Deploy Next.js app to Azure App Service using Azure CLI
# Usage: ./deploy-azure.sh <ResourceGroup> <AppServiceName>

set -e

RESOURCE_GROUP="$1"
APP_SERVICE_NAME="$2"

if [ -z "$RESOURCE_GROUP" ] || [ -z "$APP_SERVICE_NAME" ]; then
  echo "Usage: $0 <ResourceGroup> <AppServiceName>"
  exit 1
fi

echo "Installing dependencies..."
npm ci

echo "Building Next.js app..."
npm run build

echo "Creating deployment ZIP (excluding node_modules and .git)..."
zip -r app.zip . -x "node_modules/*" ".git/*"

echo "Deploying to Azure App Service..."
az webapp deploy --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" --src-path app.zip --type zip

echo "Deployment complete!"
