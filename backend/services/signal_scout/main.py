import os
import json
import uuid
import httpx
import logging
from datetime import datetime, timedelta
from google.cloud import pubsub_v1
from google import genai
from google.genai import types
from backend.packages.gembaos_core.config import models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID = os.getenv("PROJECT_ID", "gembaos-prod")
FAST_MODEL = models.get("FAST", "gemini-3.5-flash-lite")

publisher = pubsub_v1.PublisherClient()
SIGNALS_TOPIC = publisher.topic_path(PROJECT_ID, "signals.external")
client = genai.Client()

def publish_signal(signal_data: dict):
    payload = {
        "event_id": f"evt_sig_{uuid.uuid4().hex[:8]}",
        **signal_data
    }
    publisher.publish(SIGNALS_TOPIC, json.dumps(payload).encode("utf-8"))
    logger.info(f"Published signal: {signal_data.get('summary')}")

async def poll_weather_alerts():
    """Polls public CAP feeds / Weather API for plant and supplier coordinates."""
    # Mocking a response from a CAP feed (e.g., Central Weather Administration Taiwan)
    mock_weather_data = [
        {
            "headline": "Typhoon Haikui-2 Warning",
            "desc": "Severe typhoon approaching Hsinchu region. Expected landfall in 48 hours.",
            "area": "Taiwan",
            "url": "https://example-weather-api.com/alert/123",
            "as_of": datetime.utcnow().isoformat()
        }
    ]
    
    for alert in mock_weather_data:
        # Use Flash-Lite to structure the raw text into our Signal schema
        prompt = f"""
        Extract the following weather alert into JSON matching this schema:
        {{type: "weather", entities: [{{type: "region", id: "str"}}], severity: int(1-5), probability: float(0-1), time_horizon_h: int, summary: "str"}}
        Alert Text: {alert['headline']} - {alert['desc']}
        """
        response = client.models.generate_content(
            model=FAST_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        parsed = json.loads(response.text)
        signal = {
            "signal_id": f"sig_wth_{uuid.uuid4().hex[:8]}",
            "ts": datetime.utcnow().isoformat(),
            "type": parsed.get("type", "weather"),
            "geo": {"type": "Point", "coordinates": [121.0, 24.8]}, # Hsinchu approx
            "entities": parsed.get("entities", [{"type": "region", "id": "REG-TW"}]),
            "severity": parsed.get("severity", 4),
            "probability": parsed.get("probability", 0.8),
            "time_horizon_h": parsed.get("time_horizon_h", 48),
            "sources": [alert["url"]],
            "summary": parsed.get("summary"),
            "source_feed": "weather_api",
            "retrieved_at": datetime.utcnow().isoformat(),
            "as_of": alert["as_of"],
            "expires_at": (datetime.utcnow() + timedelta(minutes=45)).isoformat(), # Max age rule applied
            "is_scenario": False,
            "plant_ids": ["PNQ", "RYG", "NGO"] # Broadcast cross-plant
        }
        publish_signal(signal)

async def poll_gdelt_news():
    """Polls GDELT using real-world watch terms (e.g. 'Hsinchu semiconductor')."""
    # MVP: Mocking GDELT DOC API response execution
    logger.info("Polling GDELT DOC 2.0 API for watch_terms...")
    pass 

if __name__ == "__main__":
    import asyncio
    logger.info("Starting Signal Scout Job...")
    asyncio.run(poll_weather_alerts())
    asyncio.run(poll_gdelt_news())
    logger.info("Signal Scout Job Complete.")