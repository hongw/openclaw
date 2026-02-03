#!/bin/bash
#
# Start an ACR build from GitHub and return the build ID.
# Does NOT wait for completion - designed for async monitoring.
#
# Builds from GitHub URL instead of local directory to avoid
# memory issues when uploading large repos.
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
#   ./start-acr-build.sh myregistry
#   ./start-acr-build.sh myregistry --tag-latest
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

# Get GitHub repo URL from git remote
GITHUB_REPO=$(git remote get-url origin 2>/dev/null)
if [ -z "$GITHUB_REPO" ]; then
    echo "ERROR: Could not get origin remote URL" >&2
    exit 1
fi

# Convert SSH URL to HTTPS if needed (git@github.com:user/repo.git -> https://github.com/user/repo.git)
if [[ "$GITHUB_REPO" =~ ^git@github\.com:(.+)$ ]]; then
    GITHUB_REPO="https://github.com/${BASH_REMATCH[1]}"
fi

# Get branch name and commit ID from local repo
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
COMMIT_ID=$(git rev-parse --short=7 HEAD)

# Check if local branch is pushed to remote
REMOTE_COMMIT=$(git ls-remote origin "$BRANCH_NAME" 2>/dev/null | cut -f1 | head -c7)
if [ "$REMOTE_COMMIT" != "$COMMIT_ID" ]; then
    echo "WARNING: Local commit $COMMIT_ID differs from remote $REMOTE_COMMIT" >&2
    echo "Make sure to push your changes before building!" >&2
fi

# Extract version from branch name
if [[ "$BRANCH_NAME" =~ ^release/(.+)$ ]]; then
    VERSION_PART="${BASH_REMATCH[1]}"
else
    VERSION_PART="${BRANCH_NAME//\//-}"
fi

IMAGE_TAG="${VERSION_PART}-${COMMIT_ID}"
FULL_IMAGE="${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${IMAGE_TAG}"

# Build from GitHub URL (avoids uploading large local directory)
GITHUB_SOURCE="${GITHUB_REPO}#${BRANCH_NAME}"

# Start ACR build (no-wait returns immediately)
BUILD_OUTPUT=$(az acr build \
    --registry "$ACR_NAME" \
    --image "${IMAGE_NAME}:${IMAGE_TAG}" \
    --no-wait \
    "$GITHUB_SOURCE" 2>&1) || {
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
  "githubSource": "$GITHUB_SOURCE",
  "tagLatest": ${TAG_LATEST:-false}
}
EOF
