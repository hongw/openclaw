#!/bin/bash
#
# Deploy Moltbot image to Azure Container Apps.
#
# Usage:
#   ./deploy-to-aca.sh <container-app-name> <resource-group> <image-tag>
#
# Arguments:
#   container-app-name  The name of the Container App
#   resource-group      The resource group name
#   image-tag          The image tag to deploy (e.g., v2026.1.24-abc1234)
#
# Examples:
#   ./deploy-to-aca.sh moltbot my-resource-group v2026.1.24-abc1234
#   ./deploy-to-aca.sh moltbot my-resource-group latest
#

set -e

# Parse arguments
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Error: Missing required arguments"
    echo "Usage: $0 <container-app-name> <resource-group> <image-tag>"
    exit 1
fi

CONTAINER_APP_NAME="$1"
RESOURCE_GROUP="$2"
IMAGE_TAG="$3"

# Get ACR name from existing container app
echo "Getting current ACR configuration..."
CURRENT_IMAGE=$(az containerapp show \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query 'properties.template.containers[0].image' \
    -o tsv)

# Extract ACR name from current image (e.g., myacr.azurecr.io/moltbot:tag -> myacr)
ACR_LOGIN_SERVER=$(echo "$CURRENT_IMAGE" | cut -d'/' -f1)
ACR_NAME=$(echo "$ACR_LOGIN_SERVER" | cut -d'.' -f1)

NEW_IMAGE="${ACR_LOGIN_SERVER}/moltbot:${IMAGE_TAG}"

echo "=== Deploy to Azure Container Apps ==="
echo "Container App: ${CONTAINER_APP_NAME}"
echo "Resource Group: ${RESOURCE_GROUP}"
echo "ACR: ${ACR_LOGIN_SERVER}"
echo "Current Image: ${CURRENT_IMAGE}"
echo "New Image: ${NEW_IMAGE}"
echo ""

# Update the container app with new image
echo "Updating container app..."
az containerapp update \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$NEW_IMAGE"

echo ""
echo "=== Done ==="
echo "Deployed: ${NEW_IMAGE}"
echo ""
echo "Check status with:"
echo "  az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query 'properties.latestRevisionName' -o tsv"
