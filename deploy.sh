#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# deploy.sh — Build images locally and push to Artifact Registry.
#
# Usage:
#   ./deploy.sh                          # uses defaults from this script
#   ./deploy.sh --project my-gcp-project # override project ID
#
# Prerequisites:
#   - Docker running locally
#   - gcloud CLI authenticated (gcloud auth login)
#   - Docker configured for AR  (gcloud auth configure-docker <REGION>-docker.pkg.dev)
#   - backend/.env and backend/gcp-service-account-key.json already on the VM
# ---------------------------------------------------------------------------

# ---- Defaults (edit these to match your project) ----
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-asia-south1}"
REPO_NAME="${AR_REPO_NAME:-aniweek}"
VM_NAME="${GCE_VM_NAME:-aniweek-vm}"
ZONE="${GCE_ZONE:-asia-south1-a}"

# ---- Parse CLI flags ----
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)   PROJECT_ID="$2"; shift 2 ;;
    --region)    REGION="$2";     shift 2 ;;
    --repo)      REPO_NAME="$2";  shift 2 ;;
    --vm)        VM_NAME="$2";    shift 2 ;;
    --zone)      ZONE="$2";       shift 2 ;;
    *)           echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: GCP project ID is required."
  echo "Set GCP_PROJECT_ID env var or pass --project <id>"
  exit 1
fi

REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"

echo "==> Registry : ${REGISTRY}"
echo "==> VM       : ${VM_NAME} (${ZONE})"
echo ""

# ---- Step 1: Build images ----
echo "==> Building backend image..."
docker build -t "${REGISTRY}/backend:latest" ./backend

echo ""
echo "==> Building frontend image..."
docker build -t "${REGISTRY}/frontend:latest" ./frontend

# ---- Step 2: Push images to Artifact Registry ----
echo ""
echo "==> Pushing backend image..."
docker push "${REGISTRY}/backend:latest"

echo ""
echo "==> Pushing frontend image..."
docker push "${REGISTRY}/frontend:latest"

echo ""
echo "==> Push complete! Images are now in ${REGISTRY}"
echo "    To deploy, SSH into the VM and run:"
echo "    export REGISTRY=${REGISTRY} && cd /opt/aniweek && sudo -E docker compose -f docker-compose.prod.yml pull && sudo -E docker compose -f docker-compose.prod.yml up -d"
