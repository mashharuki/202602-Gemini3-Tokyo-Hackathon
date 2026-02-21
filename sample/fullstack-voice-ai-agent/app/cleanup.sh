#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Usage:
#   PROJECT_ID=my-gcp-project ./cleanup.sh
# Optional:
#   REGION=us-central1 SERVICE_NAME=voice-agent-backend RUNTIME_SA_NAME=cloud-run-voice-agent DELETE_SA=true FORCE=true ./cleanup.sh
#   DELETE_AR_IMAGES=true AR_REPOSITORY=cloud-run-source-deploy AR_IMAGE=voice-agent-backend ./cleanup.sh
#   DELETE_AR_REPOSITORY=true AR_LOCATION=us-central1 ./cleanup.sh

if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env"
  set +a
fi

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
REGION="${REGION:-${GOOGLE_CLOUD_LOCATION:-us-central1}}"
SERVICE_NAME="${SERVICE_NAME:-voice-agent-backend}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-cloud-run-voice-agent}"
RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
DELETE_SA="${DELETE_SA:-false}"
FORCE="${FORCE:-false}"
DELETE_AR_IMAGES="${DELETE_AR_IMAGES:-false}"
DELETE_AR_REPOSITORY="${DELETE_AR_REPOSITORY:-false}"
AR_LOCATION="${AR_LOCATION:-${REGION}}"
AR_REPOSITORY="${AR_REPOSITORY:-cloud-run-source-deploy}"
AR_IMAGE="${AR_IMAGE:-${SERVICE_NAME}}"
AR_HOST="${AR_LOCATION}-docker.pkg.dev"
AR_IMAGE_PATH="${AR_HOST}/${PROJECT_ID}/${AR_REPOSITORY}/${AR_IMAGE}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: PROJECT_ID is required."
  echo "Set PROJECT_ID or GOOGLE_CLOUD_PROJECT (e.g. in app/.env)."
  exit 1
fi

echo "==> Project: ${PROJECT_ID}"
echo "==> Region: ${REGION}"
echo "==> Service to delete: ${SERVICE_NAME}"
echo "==> Runtime SA: ${RUNTIME_SA} (DELETE_SA=${DELETE_SA})"
echo "==> Artifact Registry image cleanup: ${DELETE_AR_IMAGES} (${AR_IMAGE_PATH})"
echo "==> Artifact Registry repo cleanup: ${DELETE_AR_REPOSITORY} (${AR_LOCATION}/${AR_REPOSITORY})"

if [[ "${FORCE}" != "true" ]]; then
  read -r -p "Proceed deleting Cloud Run resources? [y/N]: " ANSWER
  if [[ ! "${ANSWER}" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

gcloud config set project "${PROJECT_ID}" >/dev/null

echo "==> Deleting Cloud Run service (if exists)..."
if gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  gcloud run services delete "${SERVICE_NAME}" --region "${REGION}" --quiet
  echo "Deleted service: ${SERVICE_NAME}"
else
  echo "Service not found: ${SERVICE_NAME}"
fi

echo "==> Removing Vertex AI IAM binding from runtime service account..."
gcloud projects remove-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role "roles/aiplatform.user" \
  --quiet || true

if [[ "${DELETE_SA}" == "true" ]]; then
  echo "==> Deleting runtime service account (if exists)..."
  if gcloud iam service-accounts describe "${RUNTIME_SA}" >/dev/null 2>&1; then
    gcloud iam service-accounts delete "${RUNTIME_SA}" --quiet
    echo "Deleted service account: ${RUNTIME_SA}"
  else
    echo "Service account not found: ${RUNTIME_SA}"
  fi
fi

if [[ "${DELETE_AR_IMAGES}" == "true" ]]; then
  echo "==> Deleting Artifact Registry images (if exists): ${AR_IMAGE_PATH}"
  DIGESTS="$(gcloud artifacts docker images list "${AR_IMAGE_PATH}" --format='get(version)' 2>/dev/null || true)"
  if [[ -z "${DIGESTS}" ]]; then
    echo "No image digests found at: ${AR_IMAGE_PATH}"
  else
    while IFS= read -r DIGEST; do
      [[ -z "${DIGEST}" ]] && continue
      gcloud artifacts docker images delete "${AR_IMAGE_PATH}@${DIGEST}" --delete-tags --quiet || true
      echo "Deleted image digest: ${DIGEST}"
    done <<< "${DIGESTS}"
  fi
fi

if [[ "${DELETE_AR_REPOSITORY}" == "true" ]]; then
  echo "==> Deleting Artifact Registry repository (if exists): ${AR_REPOSITORY}"
  if gcloud artifacts repositories describe "${AR_REPOSITORY}" --location "${AR_LOCATION}" >/dev/null 2>&1; then
    gcloud artifacts repositories delete "${AR_REPOSITORY}" --location "${AR_LOCATION}" --quiet
    echo "Deleted repository: ${AR_REPOSITORY}"
  else
    echo "Repository not found: ${AR_REPOSITORY} (${AR_LOCATION})"
  fi
fi

echo "==> Cleanup complete."
