param (
    [string]$Service = "gembaos-gateway",
    [string]$ProjectId = $env:PROJECT_ID,
    [string]$Region = "asia-southeast1"
)

if (-not $ProjectId) {
    $ProjectId = "deep-atlas-511314-r4"
}

Write-Host "=== Deploying $Service to Cloud Run in $Region (Project: $ProjectId) ===" -ForegroundColor Cyan

# Set environment variables for Cloud Run
$envVars = "PROJECT_ID=$ProjectId,ENVIRONMENT=production"
if ($env:GEMINI_API_KEY) {
    $envVars += ",GEMINI_API_KEY=$($env:GEMINI_API_KEY)"
}

Write-Host "--> Submitting build and deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $Service `
    --source . `
    --region $Region `
    --project $ProjectId `
    --allow-unauthenticated `
    --set-env-vars $envVars `
    --memory 1Gi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 5

if ($LASTEXITCODE -eq 0) {
    Write-Host "=== Deployment Succeeded! ===" -ForegroundColor Green
} else {
    Write-Host "=== Deployment Failed with exit code $LASTEXITCODE ===" -ForegroundColor Red
}

