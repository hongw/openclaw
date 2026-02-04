<#
.SYNOPSIS
    Build and push OpenClaw Docker image to Azure Container Registry.

.DESCRIPTION
    This script builds the OpenClaw Docker image and pushes it to the specified ACR.
    The image tag is automatically generated from the current branch name and commit ID.

.PARAMETER AcrName
    The name of the Azure Container Registry (without .azurecr.io suffix).

.PARAMETER TagLatest
    If specified, also tag the image as 'latest'. Default: false

.PARAMETER BuildLocal
    If specified, build the image locally and push it. Otherwise, use ACR Build (remote). Default: false

.EXAMPLE
    .\build-push-acr.ps1 -AcrName myacr
    .\build-push-acr.ps1 -AcrName myacr -TagLatest
    .\build-push-acr.ps1 -AcrName myacr -BuildLocal
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$AcrName,
    
    [Parameter(Mandatory=$false)]
    [switch]$TagLatest = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$BuildLocal = $false
)

$ErrorActionPreference = "Stop"

# Get repo root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

# Get branch name and commit ID for the image tag
Push-Location $repoRoot
try {
    $branchName = git rev-parse --abbrev-ref HEAD
    $commitId = git rev-parse --short=7 HEAD
} finally {
    Pop-Location
}

# Extract version from branch name (e.g., "release/v2026.1.24" -> "v2026.1.24")
if ($branchName -match "^release/(.+)$") {
    $versionPart = $Matches[1]
} else {
    # For other branches, sanitize the name (replace / with -)
    $versionPart = $branchName -replace "/", "-"
}

$imageTag = "$versionPart-$commitId"

$acrLoginServer = "$AcrName.azurecr.io"
$imageName = "openclaw"
$fullImageName = "$acrLoginServer/${imageName}:$imageTag"
$latestImageName = "$acrLoginServer/${imageName}:latest"

Write-Host "=== Build and Push to ACR ===" -ForegroundColor Cyan
Write-Host "ACR: $acrLoginServer"
Write-Host "Branch: $branchName"
Write-Host "Commit: $commitId"
Write-Host "Image: $fullImageName"
Write-Host "Build Mode: $(if ($BuildLocal) { 'Local' } else { 'Remote (ACR Build)' })"
if ($TagLatest) {
    Write-Host "Also tagging as: $latestImageName"
}
Write-Host ""

# Step 1: Build and push image
if ($BuildLocal) {
    # Local build and push
    Write-Host "Building image locally..." -ForegroundColor Green
    
    # Login to ACR
    Write-Host "Logging into ACR..." -ForegroundColor Yellow
    az acr login --name $AcrName
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to login to ACR"
        exit 1
    }
    
    # Build image locally
    Push-Location $repoRoot
    try {
        docker build -t $fullImageName .
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to build image locally"
            exit 1
        }
        
        # Push image
        Write-Host "Pushing image to ACR..." -ForegroundColor Green
        docker push $fullImageName
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to push image to ACR"
            exit 1
        }
    } finally {
        Pop-Location
    }
} else {
    # Remote build using ACR Build
    Write-Host "Building and pushing image using ACR Build..." -ForegroundColor Green
    Push-Location $repoRoot
    try {
        az acr build --registry $AcrName --image "${imageName}:$imageTag" .
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to build image in ACR"
            exit 1
        }
    } finally {
        Pop-Location
    }
}

# Step 2: Tag as latest if requested
if ($TagLatest) {
    Write-Host ""
    Write-Host "Tagging as latest..." -ForegroundColor Green
    
    if ($BuildLocal) {
        # For local builds, tag and push the latest image
        docker tag $fullImageName $latestImageName
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to tag image as latest"
            exit 1
        }
        
        docker push $latestImageName
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to push latest image to ACR"
            exit 1
        }
    } else {
        # For remote builds, use ACR import to tag as latest
        az acr import --name $AcrName --source "${acrLoginServer}/${imageName}:$imageTag" --image "${imageName}:latest" --force
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to tag image as latest"
            exit 1
        }
    }
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "Image pushed: $fullImageName" -ForegroundColor Green
if ($TagLatest) {
    Write-Host "Image pushed: $latestImageName" -ForegroundColor Green
}
