#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-deep-atlas-511314-r4}"
REGION="${REGION:-asia-southeast1}"

echo "=== Bootstrapping GCP Project: ${PROJECT_ID} in ${REGION} ==="

# 1. Enable required APIs
echo "--> Enabling Google Cloud APIs..."
gcloud services enable \
    aiplatform.googleapis.com \
    bigquery.googleapis.com \
    firestore.googleapis.com \
    pubsub.googleapis.com \
    run.googleapis.com \
    eventarc.googleapis.com \
    storage.googleapis.com \
    cloudbuild.googleapis.com \
    --project="${PROJECT_ID}"

# 2. Create BigQuery Datasets
echo "--> Creating BigQuery datasets..."
for dataset in bronze silver gold kg ref ai; do
    if ! bq --project_id="${PROJECT_ID}" show "${dataset}" >/dev/null 2>&1; then
        echo "Creating dataset: ${dataset}"
        bq --location="${REGION}" --project_id="${PROJECT_ID}" mk -d "${dataset}"
    else
        echo "Dataset ${dataset} already exists."
    fi
done

# 3. Create Pub/Sub Topics
echo "--> Creating Pub/Sub topics..."
TOPICS=(
    "telemetry.raw"
    "machine.state"
    "signals.external"
    "events.business"
    "events.anomaly"
    "events.quality"
    "actions.result"
    "decisions.approved"
)

for topic in "${TOPICS[@]}"; do
    if ! gcloud pubsub topics describe "${topic}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
        echo "Creating topic: ${topic}"
        gcloud pubsub topics create "${topic}" --project="${PROJECT_ID}"
    else
        echo "Topic ${topic} already exists."
    fi
done

# 4. Create Pub/Sub Pull Subscriptions
echo "--> Creating Pub/Sub subscriptions..."
if ! gcloud pubsub subscriptions describe "telemetry.raw-pull" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "Creating subscription: telemetry.raw-pull"
    gcloud pubsub subscriptions create "telemetry.raw-pull" \
        --topic="telemetry.raw" \
        --project="${PROJECT_ID}"
else
    echo "Subscription telemetry.raw-pull already exists."
fi

# 5. Create Cloud Storage Bucket for Inspections
BUCKET_NAME="${PROJECT_ID}-inspections"
echo "--> Checking Cloud Storage bucket gs://${BUCKET_NAME}..."
if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "Creating bucket: gs://${BUCKET_NAME}"
    gcloud storage buckets create "gs://${BUCKET_NAME}" --location="${REGION}" --project="${PROJECT_ID}"
else
    echo "Bucket gs://${BUCKET_NAME} already exists."
fi

echo "=== Bootstrap Completed Successfully! ==="

