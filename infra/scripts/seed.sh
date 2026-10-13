#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-deep-atlas-511314-r4}"

echo "=== Seeding BigQuery Schemas & Graph for: ${PROJECT_ID} ==="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Run schema DDL
echo "--> Applying BigQuery tables DDL (01_schema.sql)..."
bq query \
    --project_id="${PROJECT_ID}" \
    --use_legacy_sql=false \
    < "${ROOT_DIR}/backend/data/sql/01_schema.sql"

# Run property graph DDL
echo "--> Applying BigQuery property graph DDL (02_graph.sql)..."
bq query \
    --project_id="${PROJECT_ID}" \
    --use_legacy_sql=false \
    < "${ROOT_DIR}/backend/data/sql/02_graph.sql"

# Run master data seed DDL
if [ -f "${ROOT_DIR}/backend/data/sql/03_seed_master_data.sql" ]; then
    echo "--> Seeding Nova Drive Master Data (03_seed_master_data.sql)..."
    bq query \
        --project_id="${PROJECT_ID}" \
        --use_legacy_sql=false \
        < "${ROOT_DIR}/backend/data/sql/03_seed_master_data.sql"
fi

echo "=== Seeding Completed Successfully! ==="

