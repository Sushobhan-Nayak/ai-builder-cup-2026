import os
import json
import asyncio
import logging
from datetime import datetime
from google.cloud import pubsub_v1, firestore, bigquery
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID = os.getenv("PROJECT_ID", "gembaos-prod")
SUBSCRIPTION_ID = f"projects/{PROJECT_ID}/subscriptions/telemetry.raw-pull"
ANOMALY_TOPIC = f"projects/{PROJECT_ID}/topics/events.anomaly"

subscriber = pubsub_v1.SubscriberClient()
publisher = pubsub_v1.PublisherClient()
db = firestore.Client(project=PROJECT_ID)
bq = bigquery.Client(project=PROJECT_ID)

# In-memory buffer for 60-second rolling windows (MVP fallback)
# Structure: {(asset_id, metric): [values...]}
telemetry_buffer = {}

def check_anomaly_rules(asset_id: str, metric: str, avg_value: float, ts: datetime, plant_id: str):
    """Streaming tier: rolling z-score/EWMA logic for sub-second alerts."""
    # Simplified threshold for the MVP demo (CNC-07 bearing fault)
    thresholds = {
        "vib_rms": 2.5,
        "vib_kurtosis": 4.0
    }
    
    limit = thresholds.get(metric)
    if limit and avg_value > limit:
        logger.warning(f"Anomaly breach: {asset_id} {metric} = {avg_value} > {limit}")
        
        event_payload = {
            "event_id": f"evt_anom_{int(ts.timestamp())}_{asset_id}",
            "ts": ts.isoformat(),
            "plant_id": plant_id,
            "asset_id": asset_id,
            "metric": metric,
            "score": avg_value,
            "rule": "streaming_threshold",
            "window_ref": "silver.telemetry_1m"
        }
        publisher.publish(ANOMALY_TOPIC, json.dumps(event_payload).encode("utf-8"))

async def aggregate_and_flush():
    """Loops every 60 seconds to flush aggregates to BQ and Firestore."""
    while True:
        await asyncio.sleep(60)
        if not telemetry_buffer:
            continue
            
        logger.info(f"Flushing 1-minute aggregates for {len(telemetry_buffer)} streams.")
        rows_to_insert = []
        
        for (asset_id, metric, plant_id), readings in list(telemetry_buffer.items()):
            if not readings:
                continue
                
            df = pd.DataFrame(readings)
            avg_val = float(df["value"].mean())
            max_val = float(df["value"].max())
            min_val = float(df["value"].min())
            std_val = float(df["value"].std()) if len(df) > 1 else 0.0
            
            # The simulator clock rule requires keeping sim_ts aligned
            latest_ts = df["ts"].max()
            latest_sim_ts = df["sim_ts"].max()

            rows_to_insert.append({
                "ts_min": latest_ts,
                "sim_ts_min": latest_sim_ts,
                "plant_id": plant_id,
                "asset_id": asset_id,
                "metric": metric,
                "avg_value": avg_val,
                "min_value": min_val,
                "max_value": max_val,
                "std_value": std_val,
                "n": len(df)
            })
            
            # 1. Update Firestore live asset state (max 1 write/sec/doc rule met by batching)
            doc_ref = db.collection("plants").document(plant_id).collection("assets").document(asset_id)
            doc_ref.set({
                f"metrics.{metric}": avg_val,
                "last_updated": latest_ts
            }, merge=True)
            
            # 2. Check rules and trigger agents
            check_anomaly_rules(asset_id, metric, avg_val, datetime.fromisoformat(latest_ts), plant_id)
            
            # Clear buffer
            telemetry_buffer[(asset_id, metric, plant_id)] = []

        # 3. Write 1m aggregates to BigQuery
        if rows_to_insert:
            table_id = f"{PROJECT_ID}.silver.telemetry_1m"
            errors = bq.insert_rows_json(table_id, rows_to_insert)
            if errors:
                logger.error(f"BQ Insert Errors: {errors}")

def callback(message):
    """Pub/Sub pull callback."""
    try:
        data = json.loads(message.data.decode("utf-8"))
        key = (data["asset_id"], data["metric"], data["plant_id"])
        
        if key not in telemetry_buffer:
            telemetry_buffer[key] = []
            
        telemetry_buffer[key].append({
            "value": data["value"],
            "ts": data["ts"],
            "sim_ts": data["sim_ts"]
        })
        message.ack()
    except Exception as e:
        logger.error(f"Failed to process message: {e}")
        message.nack()

async def main():
    logger.info(f"Starting pull subscriber on {SUBSCRIPTION_ID}")
    future = subscriber.subscribe(SUBSCRIPTION_ID, callback)
    
    # Run the aggregate flush loop concurrently
    flush_task = asyncio.create_task(aggregate_and_flush())
    
    try:
        await asyncio.gather(flush_task)
    except KeyboardInterrupt:
        future.cancel()

if __name__ == "__main__":
    asyncio.run(main())