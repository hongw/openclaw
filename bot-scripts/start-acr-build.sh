#!/bin/bash
#
# Start an ACR build and return the build ID.
# Does NOT wait for completion - designed for async monitoring.
#
# Usage:
#   ./start-acr-build.sh <acr-name> [--tag-latest]
#
# Arguments:
#   acr-name      The Azure Container Registry name (required)
#   --tag-latest  Also tag the image as 'latest' (optional)
#
# Output:
#   Prints build info as JSON to stdout (for parsing)
#
# Examples:
#   ./start-acr-build.sh soyboxjapaneast
#   ./start-acr-build.sh soyboxjapaneast --tag-latest
#

set -e

# Parse arguments
if [ -z "$1" ] || [ "$1" = "--tag-latest" ]; then
    echo "Error: ACR name is required" >&2
    echo "Usage: $0 <acr-name> [--tag-latest]" >&2
    exit 1
fi

ACR_NAME="$1"
IMAGE_NAME="openclaw"

TAG_LATEST=""
if [ "$2" = "--tag-latest" ]; then
    TAG_LATEST="true"
fi

# Get repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$REPO_ROOT"

# Get branch name and commit ID
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
COMMIT_ID=$(git rev-parse --short=7 HEAD)

# Extract version from branch name
if [[ "$BRANCH_NAME" =~ ^release/(.+)$ ]]; then
    VERSION_PART="${BASH_REMATCH[1]}"
else
    VERSION_PART="${BRANCH_NAME//\//-}"
fi

IMAGE_TAG="${VERSION_PART}-${COMMIT_ID}"
FULL_IMAGE="${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${IMAGE_TAG}"

# Start ACR build (no-wait returns immediately)
# We use --no-logs to avoid blocking on log streaming
BUILD_OUTPUT=$(az acr build \
    --registry "$ACR_NAME" \
    --image "${IMAGE_NAME}:${IMAGE_TAG}" \
    --file Dockerfile \
    --no-logs \
    . 2>&1) || {
    echo "ERROR: Failed to start build" >&2
    echo "$BUILD_OUTPUT" >&2
    exit 1
}

# Get the most recent build ID (the one we just started)
sleep 2  # Brief wait for build to register
BUILD_ID=$(az acr task list-runs \
    --registry "$ACR_NAME" \
    --top 1 \
    --query '[0].runId' \
    -o tsv 2>/dev/null)

if [ -z "$BUILD_ID" ]; then
    echo "ERROR: Could not get build ID" >&2
    exit 1
fi

# Output as JSON for easy parsing
cat << EOF
{
  "buildId": "$BUILD_ID",
  "imageTag": "$IMAGE_TAG",
  "fullImage": "$FULL_IMAGE",
  "acrName": "$ACR_NAME",
  "branch": "$BRANCH_NAME",
  "commit": "$COMMIT_ID",
  "tagLatest": ${TAG_LATEST:-false}
}
EOF
