# ==============================================================================
# Installation & Setup
# ==============================================================================

# Install dependencies using npm
install:
	npm ci

# ==============================================================================
# Playground Targets
# ==============================================================================

# Launch local dev playground
playground:
	@echo "==============================================================================="
	@echo "| Starting your agent playground...                                           |"
	@echo "|                                                                             |"
	@echo "| Try asking: What's the weather in San Francisco?                             |"
	@echo "==============================================================================="
	npm run build && npm run dev

# ==============================================================================
# Local Development Commands
# ==============================================================================

# Launch local development server
local-backend:
	npm run build && npx @google/adk-devtools api_server -h localhost --port 8000 dist/agent.js

# Run agent with CLI
run:
	npm run run

# ==============================================================================
# Backend Deployment Targets
# ==============================================================================

# Deploy the agent remotely
# Usage: make deploy [IAP=true] [PORT=8080] - Set IAP=true to enable Identity-Aware Proxy, PORT to specify container port
deploy:
	PROJECT_ID=$$(gcloud config get-value project) && \
	AGENT_VERSION=$$(node -e "console.log(require('./package.json').version)") && \
	gcloud beta run deploy my-ts-agent \
		--source . \
		--memory "4Gi" \
		--project $$PROJECT_ID \
		--region "us-central1" \
		--no-allow-unauthenticated \
		--no-cpu-throttling \
		--labels "created-by=adk" \
		--update-build-env-vars "AGENT_VERSION=$$AGENT_VERSION" \
		--update-env-vars \
		"COMMIT_SHA=$(shell git rev-parse HEAD),GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$$PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1" \
		$(if $(IAP),--iap) \
		$(if $(PORT),--port=$(PORT))

# Alias for 'make deploy' for backward compatibility
backend: deploy

# ==============================================================================
# Infrastructure Setup
# ==============================================================================

# Set up development environment resources using Terraform
setup-dev-env:
	PROJECT_ID=$$(gcloud config get-value project) && \
	(cd deployment/terraform/dev && terraform init && terraform apply --var-file vars/env.tfvars --var dev_project_id=$$PROJECT_ID --auto-approve)

# Destroy deployed Cloud Run service using gcloud CLI
destroy:
	PROJECT_ID=$$(gcloud config get-value project) && \
	gcloud run services delete my-ts-agent \
		--project $$PROJECT_ID \
		--region "us-central1" \
		--quiet

# Destroy Cloud Run service and Artifact Registry repository using gcloud CLI
# Usage: make destroy-all [SERVICE_NAME=my-ts-agent] [AR_REPOSITORY=my-ts-agent] [AR_LOCATION=us-central1]
destroy-all:
	PROJECT_ID=$$(gcloud config get-value project) && \
	SERVICE_NAME=$${SERVICE_NAME:-my-ts-agent} && \
	AR_REPOSITORY=$${AR_REPOSITORY:-my-ts-agent} && \
	AR_LOCATION=$${AR_LOCATION:-us-central1} && \
	if gcloud run services describe $$SERVICE_NAME --project $$PROJECT_ID --region "us-central1" >/dev/null 2>&1; then \
		gcloud run services delete $$SERVICE_NAME --project $$PROJECT_ID --region "us-central1" --quiet; \
	else \
		echo "Cloud Run service '$$SERVICE_NAME' not found in us-central1. Skipping."; \
	fi && \
	if gcloud artifacts repositories describe $$AR_REPOSITORY --project $$PROJECT_ID --location $$AR_LOCATION >/dev/null 2>&1; then \
		gcloud artifacts repositories delete $$AR_REPOSITORY --project $$PROJECT_ID --location $$AR_LOCATION --quiet; \
	else \
		echo "Artifact Registry repository '$$AR_REPOSITORY' not found in '$$AR_LOCATION'. Skipping."; \
	fi

# ==============================================================================
# Testing & Code Quality
# ==============================================================================

# Run unit and integration tests
test:
	npm run test

# Run load tests (requires local-backend running in another terminal)
load-test:
	npx tsx tests/load_test/load_test.ts

# Run code quality checks
lint:
	npm run lint

# ==============================================================================
# TypeScript-specific targets
# ==============================================================================

# Build TypeScript
build:
	npm run build

# Type checking only
typecheck:
	npm run typecheck

# Clean build artifacts
clean:
	rm -rf dist node_modules
