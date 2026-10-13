#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-deep-atlas-511314-r4}"
REGION="${REGION:-asia-southeast1}"

echo "=== Deploying Cloud Run Microservices for: ${PROJECT_ID} in ${REGION} ==="

SERVICES=(
    "action-executor:backend/services/action_executor/main:app:8080"
    "orchestrator:backend/services/agents/orchestrator/main:app:8080"
    "live-gateway:backend/services/live_gateway/main:app:8080"
    "signal-scout:backend/services/signal_scout/main:app:8080"
    "stream-processor:backend/services/stream_processor/main:app:8080"
    "vision-inspector:backend/services/vision_inspector/main:app:8080"
    "simulator:backend/services/simulator/main:app:8080"
)

echo "Ready to build and deploy Cloud Run services."
echo "Ensure Cloud Build is configured and submit images per service:"
echo "gcloud builds submit --config=cloudbuild.yaml . --project=${PROJECT_ID}"

