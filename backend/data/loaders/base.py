import os
import json
import argparse
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatasetLoader:
    def __init__(self, name: str, source_url: str, license_type: str, is_commercial_safe: bool):
        self.name = name
        self.source_url = source_url
        self.license_type = license_type
        self.is_commercial_safe = is_commercial_safe
        
        parser = argparse.ArgumentParser(description=f"Loader for {self.name}")
        parser.add_argument("--out", type=str, help="GCS URI or local path for output")
        parser.add_argument("--bq", type=str, help="BigQuery dataset target (e.g., project:bronze)")
        parser.add_argument("--license-mode", type=str, default=os.getenv("DATA_LICENSE_MODE", "commercial"), 
                            choices=["commercial", "research"])
        self.args, _ = parser.parse_known_args()

    def verify_license(self):
        """Enforces the strict dataset licensing rules from Appendix G."""
        if self.args.license_mode == "commercial" and not self.is_commercial_safe:
            raise PermissionError(
                f"License Violation: {self.name} uses {self.license_type}. "
                f"It cannot be loaded when --license-mode is set to 'commercial'."
            )
        logger.info(f"License check passed for {self.name} in {self.args.license_mode} mode.")

    def write_manifest(self, out_dir: str, row_count: int, sha256_hash: str = "N/A"):
        """Writes MANIFEST.json for provenance tracking in the Governance console."""
        manifest = {
            "dataset_name": self.name,
            "source_url": self.source_url,
            "license": self.license_type,
            "license_mode_used": self.args.license_mode,
            "loaded_at": datetime.utcnow().isoformat(),
            "row_count": row_count,
            "sha256": sha256_hash
        }
        
        # In a real run, this would be written to the `out_dir` (e.g., GCS or local)
        # and a row inserted into BigQuery `ref.data_sources`.
        logger.info(f"Generated MANIFEST.json: {json.dumps(manifest, indent=2)}")