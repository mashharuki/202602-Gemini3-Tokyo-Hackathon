#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Usage:
#   PROJECT_ID=my-gcp-project ./deploy.sh
# Optional:
#   REGION=us-central1 SERVICE_NAME=voice-agent-backend RUNTIME_SA_NAME=cloud-run-voice-agent ./deploy.sh

if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  # Export all vars loaded from .env into this script process.
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env"
  set +a
fi

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
REGION="${REGION:-${GOOGLE_CLOUD_LOCATION:-us-central1}}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: PROJECT_ID is required."
  echo "Set PROJECT_ID or GOOGLE_CLOUD_PROJECT (e.g. in .env)."
  echo "Example: PROJECT_ID=my-gcp-project ./deploy.sh"
  exit 1
fi

SERVICE_NAME="${SERVICE_NAME:-voice-agent-backend}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-cloud-run-voice-agent}"
RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> Project: ${PROJECT_ID}"
echo "==> Region: ${REGION}"
echo "==> Service: ${SERVICE_NAME}"
echo "==> Runtime SA: ${RUNTIME_SA}"

gcloud config set project "${PROJECT_ID}" >/dev/null

echo "==> Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com

echo "==> Ensuring runtime service account exists..."
if ! gcloud iam service-accounts describe "${RUNTIME_SA}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_SA_NAME}" \
    --display-name "Cloud Run Voice Agent"
else
  echo "Service account already exists: ${RUNTIME_SA}"
fi

echo "==> Granting Vertex AI access to runtime service account..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role "roles/aiplatform.user" \
  --quiet

echo "==> Deploying Cloud Run service from . ..."
gcloud run deploy "${SERVICE_NAME}" \
  --source "${SCRIPT_DIR}" \
  --region "${REGION}" \
  --service-account "${RUNTIME_SA}" \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 3600 \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION}"

URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format='value(status.url)')"
echo "==> Deployed: ${URL}"
