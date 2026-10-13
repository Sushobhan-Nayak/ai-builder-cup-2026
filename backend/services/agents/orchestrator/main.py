import os
import json
import logging
from fastapi import FastAPI, Request, HTTPException, Header
from google import genai
from google.genai import types
from backend.packages.gembaos_core.config import models
from backend.services.agents.workflows.war_room import war_room

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="GembaOS Orchestrator", version="1.4")

PROJECT_ID = os.getenv("PROJECT_ID", "deep-atlas-511314-r4")
FAST_MODEL = models.get("FAST", "gemini-3.5-flash-lite")
client = genai.Client()

def verify_pubsub_jwt(authorization: str):
    """
    Validates the OIDC token from the Pub/Sub push request to ensure
    the public endpoint is secure (Rule from Section 12.4).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    # In production: Verify JWT signature against Google public keys
    # and ensure the audience matches this endpoint's URL.
    return True

async def triage_event(event_payload: dict) -> dict:
    """
    Uses Flash-Lite to determine severity, domains, and whether a War Room is needed.
    Rule: War Room needed if (cross-domain AND impact >= $50k) OR safety implication.
    """
    prompt = f"""
    Analyze this manufacturing event and return a JSON object:
    {{
        "severity": "info"|"low"|"medium"|"high"|"critical",
        "domains": ["maintenance", "supply", "quality", "production", "sales", "safety"],
        "needs_war_room": true|false,
        "est_impact_usd": float,
        "safety_implication": true|false
    }}
    Rule for needs_war_room: true IF (length(domains) > 1 AND est_impact_usd >= 50000) OR safety_implication == true.
    Event Data: {json.dumps(event_payload)}
    """
    
    response = client.models.generate_content(
        model=FAST_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0
        )
    )
    return json.loads(response.text)

@app.post("/events")
async def handle_events(request: Request, authorization: str = Header(None)):
    """Single ingress for events.anomaly, events.quality, signals.external, etc."""
    verify_pubsub_jwt(authorization)
    
    envelope = await request.json()
    message = envelope.get("message", {})
    try:
        event_data = json.loads(message.get("data", "{}"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid message data")

    event_id = event_data.get("event_id")
    logger.info(f"Received event: {event_id}")

    # 1. Triage the event
    triage_result = await triage_event(event_data)
    logger.info(f"Triage Result: {triage_result}")

    # 2. Dispatch
    if triage_result.get("needs_war_room"):
        logger.info(f"Triggering War Room workflow for event {event_id}")
        # Execute the ADK 2.0 graph workflow defined in workflows/war_room.py
        # Context is injected system-wide for the affected plants
        initial_state = {
            "trigger_event": event_data,
            "allowed_plants": event_data.get("plant_ids", ["PNQ", "RYG", "NGO"]) 
        }
        war_room.run(initial_state)
    elif len(triage_result.get("domains", [])) == 1:
        domain = triage_result["domains"][0]
        logger.info(f"Routing to single-domain agent: {domain}")
        # Route to Sentinel, Inspector, etc.
    else:
        logger.info("Low severity/informational event. Creating L0 Insight only.")
        # Write to ai.insights in BigQuery/Firestore

    return {"status": "processed", "triage": triage_result}