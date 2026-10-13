param (
    [string]$ProjectId = $env:PROJECT_ID
)

if (-not $ProjectId) {
    $ProjectId = "deep-atlas-511314-r4"
}

Write-Host "=== Seeding BigQuery Schemas & Graph for: $ProjectId ===" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent (Split-Path -Parent $scriptDir)

$schemaSql = Join-Path $rootDir "backend\data\sql\01_schema.sql"
$graphSql = Join-Path $rootDir "backend\data\sql\02_graph.sql"
$seedSql = Join-Path $rootDir "backend\data\sql\03_seed_master_data.sql"

# Apply BigQuery table DDL
Write-Host "--> Applying BigQuery tables DDL (01_schema.sql)..." -ForegroundColor Yellow
Get-Content $schemaSql -Raw | bq query --project_id=$ProjectId --use_legacy_sql=false

# Apply Property Graph DDL
Write-Host "--> Applying BigQuery property graph DDL (02_graph.sql)..." -ForegroundColor Yellow
Get-Content $graphSql -Raw | bq query --project_id=$ProjectId --use_legacy_sql=false

# Apply Master Data Seed
if (Test-Path $seedSql) {
    Write-Host "--> Seeding Nova Drive Master Data (03_seed_master_data.sql)..." -ForegroundColor Yellow
    Get-Content $seedSql -Raw | bq query --project_id=$ProjectId --use_legacy_sql=false
}

Write-Host "=== Seeding Completed Successfully! ===" -ForegroundColor Green

