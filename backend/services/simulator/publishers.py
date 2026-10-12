import os
import json
import logging
from datetime import datetime
from google.cloud import pubsub_v1

logger = logging.getLogger(__name__)

PROJECT_ID = os.getenv("PROJECT_ID", "gembaos-prod")

class EventPublisher:
    def __init__(self):
        self.publisher = pubsub_v1.PublisherClient()
        self.telemetry_topic = self.publisher.topic_path(PROJECT_ID, "telemetry.raw")
        self.state_topic = self.publisher.topic_path(PROJECT_ID, "machine.state")
        self.signals_topic = self.publisher.topic_path(PROJECT_ID, "signals.external")
        self.business_topic = self.publisher.topic_path(PROJECT_ID, "events.business")

    def publish_telemetry(self, event_id: str, ts: datetime, sim_ts: datetime, plant_id: str, 
                          line_id: str, asset_id: str, sensor_id: str, metric: str, 
                          value: float, unit: str, quality: str = "GOOD"):
        """Publishes 1Hz raw telemetry data."""
        payload = {
            "event_id": event_id,
            "ts": ts.isoformat(),
            "sim_ts": sim_ts.isoformat(),
            "plant_id": plant_id,
            "line_id": line_id,
            "asset_id": asset_id,
            "sensor_id": sensor_id,
            "metric": metric,
            "value": value,
            "unit": unit,
            "quality": quality
        }
        self.publisher.publish(self.telemetry_topic, json.dumps(payload).encode("utf-8"))

    def publish_signal(self, payload: dict):
        """Publishes Lane B external signals (e.g., scenarios)."""
        self.publisher.publish(self.signals_topic, json.dumps(payload).encode("utf-8"))
        
publisher = EventPublisher()