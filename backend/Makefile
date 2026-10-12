.PHONY: bootstrap seed deploy clean

PROJECT_ID ?= gembaos-prod
REGION ?= asia-southeast1

bootstrap:
	@echo "Bootstrapping GCP project $(PROJECT_ID) in $(REGION)..."
	# Runs the gcloud API enablement, GCS buckets, and Pub/Sub topic creation (Section 15.2)
	bash infra/scripts/bootstrap.sh

seed:
	@echo "Seeding master data and historical telemetry..."
	# Ingests the 18 months of history and Nova Drive master data into BigQuery
	bash infra/scripts/seed.sh

deploy:
	@echo "Building and deploying Cloud Run microservices..."
	# Deploys api-gateway, optimizer, vision-inspector, etc.
	bash infra/scripts/deploy_all.sh
	@echo "Deploying Next.js UI to Firebase App Hosting..."
	firebase apphosting:backends:create --project $(PROJECT_ID)

clean:
	@echo "Cleaning local build artifacts..."
	rm -rf .venv/ __pycache__/ .pytest_cache/