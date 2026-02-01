#!/bin/bash
#
# Build and push Moltbot Docker image to Azure Container Registry.
#
# Usage:
#   ./build-push-acr.sh <acr-name> [--tag-latest]
#
# Arguments:
#   acr-name      The name of the Azure Container Registry (without .azurecr.io suffix)
#   --tag-latest  Also tag the image as 'latest' (optional)
#
# Examples:
#   ./build-push-acr.sh myacr
#   ./build-push-acr.sh myacr --tag-latest
#

set -e

# Parse arguments
if [ -z "$1" ]; then
    echo "Error: ACR name is required"
    echo "Usage: $0 <acr-name> [--tag-latest]"
    exit 1
fi

ACR_NAME="$1"
TAG_LATEST=false

if [ "$2" = "--tag-latest" ]; then
    TAG_LATEST=true
fi

# Get repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Get branch name and commit ID for the image tag
cd "$REPO_ROOT"
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
COMMIT_ID=$(git rev-parse --short=7 HEAD)

# Extract version from branch name (e.g., "release/v2026.1.24" -> "v2026.1.24")
if [[ "$BRANCH_NAME" =~ ^release/(.+)$ ]]; then
    VERSION_PART="${BASH_REMATCH[1]}"
else
    # For other branches, sanitize the name (replace / with -)
    VERSION_PART="${BRANCH_NAME//\//-}"
fi

IMAGE_TAG="${VERSION_PART}-${COMMIT_ID}"

ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"
IMAGE_NAME="moltbot"
FULL_IMAGE_NAME="${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}"
LATEST_IMAGE_NAME="${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest"

echo "=== Build and Push to ACR ==="
echo "ACR: ${ACR_LOGIN_SERVER}"
echo "Branch: ${BRANCH_NAME}"
echo "Commit: ${COMMIT_ID}"
echo "Image: ${FULL_IMAGE_NAME}"
if [ "$TAG_LATEST" = true ]; then
    echo "Also tagging as: ${LATEST_IMAGE_NAME}"
fi
echo ""

# Step 1: Build the Docker image using ACR Tasks (cloud build)
# Note: ACR cloud build doesn't require local Docker or ACR login
echo "Building Docker image in ACR (cloud build)..."
az acr build \
    --registry "$ACR_NAME" \
    --image "${IMAGE_NAME}:${IMAGE_TAG}" \
    --file Dockerfile \
    .

# Step 3: Tag as latest if requested
if [ "$TAG_LATEST" = true ]; then
    echo ""
    echo "Tagging as latest..."
    az acr import \
        --name "$ACR_NAME" \
        --source "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}" \
        --image "${IMAGE_NAME}:latest" \
        --force
fi

echo ""
echo "=== Done ==="
echo "Image pushed: ${FULL_IMAGE_NAME}"
if [ "$TAG_LATEST" = true ]; then
    echo "Image pushed: ${LATEST_IMAGE_NAME}"
fi
