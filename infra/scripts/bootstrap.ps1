param (
    [string]$ProjectId = $env:PROJECT_ID,
    [string]$Region = "asia-southeast1"
)

if (-not $ProjectId) {
    $ProjectId = "deep-atlas-511314-r4"
}

Write-Host "=== Bootstrapping GCP Project: $ProjectId in $Region ===" -ForegroundColor Cyan

# 1. Enable required APIs
Write-Host "--> Enabling Google Cloud APIs..." -ForegroundColor Yellow
gcloud services enable `
    aiplatform.googleapis.com `
    bigquery.googleapis.com `
    firestore.googleapis.com `
    pubsub.googleapis.com `
    run.googleapis.com `
    eventarc.googleapis.com `
    storage.googleapis.com `
    cloudbuild.googleapis.com `
    --project=$ProjectId

# 2. Create BigQuery Datasets
Write-Host "--> Creating BigQuery datasets..." -ForegroundColor Yellow
$datasets = @("bronze", "silver", "gold", "kg", "ref", "ai")
foreach ($ds in $datasets) {
    bq --project_id=$ProjectId show $ds 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Creating dataset: $ds" -ForegroundColor Green
        bq --location=$Region --project_id=$ProjectId mk -d $ds
    } else {
        Write-Host "Dataset $ds already exists." -ForegroundColor Gray
    }
}

# 3. Create Pub/Sub Topics
Write-Host "--> Creating Pub/Sub topics..." -ForegroundColor Yellow
$topics = @(
    "telemetry.raw",
    "machine.state",
    "signals.external",
    "events.business",
    "events.anomaly",
    "events.quality",
    "actions.result",
    "decisions.approved"
)

foreach ($topic in $topics) {
    gcloud pubsub topics describe $topic --project=$ProjectId 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Creating topic: $topic" -ForegroundColor Green
        gcloud pubsub topics create $topic --project=$ProjectId
    } else {
        Write-Host "Topic $topic already exists." -ForegroundColor Gray
    }
}

# 4. Create Pub/Sub Pull Subscriptions
Write-Host "--> Creating Pub/Sub pull subscription: telemetry.raw-pull..." -ForegroundColor Yellow
gcloud pubsub subscriptions describe telemetry.raw-pull --project=$ProjectId 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating subscription: telemetry.raw-pull" -ForegroundColor Green
    gcloud pubsub subscriptions create telemetry.raw-pull --topic=telemetry.raw --project=$ProjectId
} else {
    Write-Host "Subscription telemetry.raw-pull already exists." -ForegroundColor Gray
}

# 5. Create Cloud Storage Bucket
$bucketName = "$ProjectId-inspections"
Write-Host "--> Checking Cloud Storage bucket gs://$bucketName..." -ForegroundColor Yellow
gcloud storage buckets describe "gs://$bucketName" --project=$ProjectId 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating bucket: gs://$bucketName" -ForegroundColor Green
    gcloud storage buckets create "gs://$bucketName" --location=$Region --project=$ProjectId
} else {
    Write-Host "Bucket gs://$bucketName already exists." -ForegroundColor Gray
}

Write-Host "=== Bootstrap Completed Successfully! ===" -ForegroundColor Green

