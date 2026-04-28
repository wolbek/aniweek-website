# ---------------------------------------------------------------------------
# deploy.ps1 — Build images locally and push to Artifact Registry.
#
# Usage:
#   .\deploy.ps1 -Project my-gcp-project
#   .\deploy.ps1 -Project my-gcp-project -Region asia-south1 -Repo aniweek -Vm aniweek-vm -Zone asia-south1-a
#
# Prerequisites:
#   - Docker running locally
#   - gcloud CLI authenticated (gcloud auth login)
#   - Docker configured for AR  (gcloud auth configure-docker <REGION>-docker.pkg.dev)
#   - backend/.env and backend/gcp-service-account-key.json already on the VM
# ---------------------------------------------------------------------------

param(
    [string]$Project  = $env:GCP_PROJECT_ID,
    [string]$Region   = $(if ($env:GCP_REGION) { $env:GCP_REGION } else { "asia-south1" }),
    [string]$Repo     = $(if ($env:AR_REPO_NAME) { $env:AR_REPO_NAME } else { "aniweek" }),
    [string]$Vm       = $(if ($env:GCE_VM_NAME) { $env:GCE_VM_NAME } else { "aniweek-vm" }),
    [string]$Zone     = $(if ($env:GCE_ZONE) { $env:GCE_ZONE } else { "asia-south1-a" })
)

$ErrorActionPreference = "Stop"

if (-not $Project) {
    Write-Error "GCP project ID is required. Set `$env:GCP_PROJECT_ID or pass -Project <id>"
    exit 1
}

$Registry = "$Region-docker.pkg.dev/$Project/$Repo"

Write-Host "==> Registry : $Registry"
Write-Host "==> VM       : $Vm ($Zone)"
Write-Host ""

# ---- Step 1: Build images ----
Write-Host "==> Building backend image..."
docker build -t "$Registry/backend:latest" ./backend
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "==> Building frontend image..."
docker build -t "$Registry/frontend:latest" ./frontend
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# ---- Step 2: Push images to Artifact Registry ----
Write-Host ""
Write-Host "==> Pushing backend image..."
docker push "$Registry/backend:latest"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "==> Pushing frontend image..."
docker push "$Registry/frontend:latest"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "==> Push complete! Images are now in $Registry"
Write-Host "    To deploy, SSH into the VM and run:"
Write-Host "    export REGISTRY=$Registry && cd /opt/aniweek && sudo -E docker compose -f docker-compose.prod.yml pull && sudo -E docker compose -f docker-compose.prod.yml up -d"

