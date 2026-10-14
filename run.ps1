param (
    [Parameter(Position=0)]
    [string]$Target = "help",
    [string]$ProjectId = $env:PROJECT_ID
)

if (-not $ProjectId) {
    $ProjectId = "deep-atlas-511314-r4"
}

switch ($Target.ToLower()) {
    "bootstrap" {
        & "$PSScriptRoot\infra\scripts\bootstrap.ps1" -ProjectId $ProjectId
    }
    "seed" {
        & "$PSScriptRoot\infra\scripts\seed.ps1" -ProjectId $ProjectId
    }
    "simulator" {
        Write-Host "Starting GembaOS Simulator on http://localhost:8082 ..." -ForegroundColor Cyan
        uvicorn backend.services.simulator.main:app --port 8082 --reload
    }
    "orchestrator" {
        Write-Host "Starting GembaOS Orchestrator on http://localhost:8080 ..." -ForegroundColor Cyan
        uvicorn backend.services.agents.orchestrator.main:app --port 8080 --reload
    }
    "gateway" {
        Write-Host "Starting GembaOS API Gateway on http://localhost:8000 ..." -ForegroundColor Cyan
        uvicorn backend.services.api_gateway.main:app --port 8000 --reload
    }
    "optimizer" {
        Write-Host "Starting GembaOS Optimizer on http://localhost:8084 ..." -ForegroundColor Cyan
        uvicorn backend.services.optimizer.main:app --port 8084 --reload
    }
    "deploy" {
        & "$PSScriptRoot\infra\scripts\deploy.ps1" -ProjectId $ProjectId
    }
    "clean" {
        Write-Host "Cleaning local build artifacts..." -ForegroundColor Yellow
        Get-ChildItem -Path . -Include __pycache__, .pytest_cache -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
        Write-Host "Done!" -ForegroundColor Green
    }
    default {
        Write-Host "Usage: .\run.ps1 <target>" -ForegroundColor Cyan
        Write-Host "Targets:"
        Write-Host "  bootstrap    - Provision GCP APIs, BigQuery datasets, Pub/Sub topics"
        Write-Host "  seed         - Apply BigQuery schemas and Property Graph DDL"
        Write-Host "  gateway      - Run API Gateway BFF locally (port 8000)"
        Write-Host "  simulator    - Run factory simulation service locally (port 8082)"
        Write-Host "  orchestrator - Run orchestrator service locally (port 8080)"
        Write-Host "  optimizer    - Run CP-SAT scheduling & CTP service locally (port 8084)"
        Write-Host "  deploy       - Build and deploy backend to Google Cloud Run"
        Write-Host "  clean        - Remove local cache artifacts"
    }
}

