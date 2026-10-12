import os
import json
import logging
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException
from google.cloud import bigquery, pubsub_v1
from google import genai
from google.genai import types
from backend.packages.gembaos_core.config import models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="GembaOS Vision Inspector", version="1.4")

PROJECT_ID = os.getenv("PROJECT_ID", "gembaos-prod")
FAST_MODEL = models.get("FAST", "gemini-3.5-flash-lite")
VISION_MODEL = models.get("VISION", "gemini-3.8-flash")

bq = bigquery.Client(project=PROJECT_ID)
publisher = pubsub_v1.PublisherClient()
QUALITY_TOPIC = publisher.topic_path(PROJECT_ID, "events.quality")
client = genai.Client()

# Curated taxonomy for few-shot prompting
TAXONOMY = """
Defect taxonomy:
1. porosity: small holes or voids in the casting surface
2. crack: visible fractures
3. cold-shut: linear discontinuity where metal flows failed to fuse
4. flash: excess material on edges
Return JSON matching: {is_defect: bool, defect_type: str, severity: "minor"|"major"|"critical", boxes: [{"label": str, "box_2d": [ymin, xmin, ymax, xmax]}], confidence: float, rationale: str}
"""

@app.post("/")
async def handle_eventarc(request: Request):
    """Eventarc push endpoint for google.cloud.storage.object.v1.finalized"""
    payload = await request.json()
    bucket = payload.get("bucket")
    file_name = payload.get("name")
    
    if not file_name or not bucket:
        raise HTTPException(status_code=400, detail="Invalid GCS payload")

    gcs_uri = f"gs://{bucket}/{file_name}"
    logger.info(f"Processing image: {gcs_uri}")

    # Stage 1: Fast screen (Flash-Lite)
    stage1_response = client.models.generate_content(
        model=FAST_MODEL,
        contents=[
            "Is there any visible manufacturing defect in this casting? Reply strictly with 'OK' or 'SUSPECT'.",
            types.Part.from_uri(file_uri=gcs_uri, mime_type="image/jpeg")
        ]
    )
    
    stage = "Stage 1"
    is_defect = False
    result_data = {}

    if "SUSPECT" in stage1_response.text.upper():
        # Stage 2: Deep Few-Shot Reasoning (Gemini 3.8 Flash)
        stage = "Stage 2"
        stage2_response = client.models.generate_content(
            model=VISION_MODEL,
            contents=[
                TAXONOMY,
                "Analyze this image and return the bounding boxes for any defects.",
                types.Part.from_uri(file_uri=gcs_uri, mime_type="image/jpeg")
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0
            )
        )
        result_data = json.loads(stage2_response.text)
        is_defect = result_data.get("is_defect", False)

    # 1. Write to BigQuery silver.inspections
    inspection_id = f"ins_{file_name.split('.')[0]}"
    row = {
        "inspection_id": inspection_id,
        "ts": datetime.utcnow().isoformat(),
        "plant_id": "RYG", # Hardcoded for demo/MVP payload extraction
        "asset_id": "RYG-CAST-01",
        "lot_id": "L-4471",
        "sku_id": "HSG-220",
        "image_ref": {"uri": gcs_uri, "version": "1", "authorizer": "vision-inspector", "details": {}},
        "stage": stage,
        "model_id": VISION_MODEL if is_defect else FAST_MODEL,
        "is_defect": is_defect,
        "defect_type": result_data.get("defect_type", "none"),
        "severity": result_data.get("severity", "none"),
        "confidence": result_data.get("confidence", 0.99),
        "bboxes": json.dumps(result_data.get("boxes", [])),
        "rationale": result_data.get("rationale", "Passed Stage 1 screen.")
    }
    
    bq.insert_rows_json(f"{PROJECT_ID}.silver.inspections", [row])

    # 2. Publish to events.quality if defect found
    if is_defect:
        event_payload = {
            "event_id": f"evt_qual_{inspection_id}",
            "inspection_id": inspection_id,
            "plant_id": "RYG",
            "lot_id": "L-4471",
            "defect_type": row["defect_type"],
            "severity": row["severity"],
            "confidence": row["confidence"]
        }
        publisher.publish(QUALITY_TOPIC, json.dumps(event_payload).encode("utf-8"))

    return {"status": "processed", "stage": stage, "is_defect": is_defect}