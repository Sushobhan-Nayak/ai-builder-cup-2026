"""
Seed realistic operational data into BigQuery tables:
- silver.machine_states: 7 days of shift state logs (RUNNING, IDLE, DOWN, SETUP)
- silver.telemetry_1m: sensor metrics (vibration, temp, current) for key assets
- silver.inspections: visual quality inspection logs (normal vs defect porosity)
"""

import os
from datetime import datetime, timedelta
import random
from google.cloud import bigquery

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "deep-atlas-511314-r4")
client = bigquery.Client(project=PROJECT_ID)

def seed_machine_states():
    table_id = f"{PROJECT_ID}.silver.machine_states"
    print(f"Seeding {table_id}...")

    # Clear recent rows
    try:
        client.query(f"DELETE FROM `{table_id}` WHERE ts_start > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)").result()
    except Exception as e:
        print(f"Notice during delete: {e}")

    now = datetime.utcnow()
    rows = []

    # Plant profiles
    # PNQ: OEE target ~76.8% (Availability ~86%, Perf ~92%, Qual ~97.2%)
    # RYG: OEE target ~81.2% (Availability ~91%, Perf ~94%, Qual ~95.0% with elevated scrap)
    # NGO: OEE target ~89.5% (Availability ~95%, Perf ~97%, Qual ~97.3% lean benchmark)
    plant_configs = [
        {
            "plant_id": "PNQ",
            "assets": [
                {"id": "PNQ-CNC-07", "sku": "TM-300", "cycle_s": 45.0, "degrading": True},
                {"id": "PNQ-CNC-08", "sku": "TM-300", "cycle_s": 45.0, "degrading": False}
            ],
            "avail_rate": 0.86,
            "perf_factor": 0.92,
            "scrap_rate": 0.018
        },
        {
            "plant_id": "RYG",
            "assets": [
                {"id": "RYG-DC-01", "sku": "INV-200", "cycle_s": 30.0, "degrading": False},
                {"id": "RYG-DC-02", "sku": "INV-200", "cycle_s": 30.0, "degrading": False}
            ],
            "avail_rate": 0.91,
            "perf_factor": 0.94,
            "scrap_rate": 0.046 # High scrap rate due to casting porosity
        },
        {
            "plant_id": "NGO",
            "assets": [
                {"id": "NGO-GR-01", "sku": "AXLE-100", "cycle_s": 60.0, "degrading": False},
                {"id": "NGO-GR-02", "sku": "AXLE-100", "cycle_s": 60.0, "degrading": False}
            ],
            "avail_rate": 0.95,
            "perf_factor": 0.97,
            "scrap_rate": 0.005 # Low scrap rate
        }
    ]

    for pcfg in plant_configs:
        pid = pcfg["plant_id"]
        for asset in pcfg["assets"]:
            aid = asset["id"]
            # Generate 7 days of 4-hour shifts
            for day_offset in range(7, 0, -1):
                day_start = now - timedelta(days=day_offset)
                for shift in range(6): # 6x 4-hour windows per day = 24h
                    start_time = day_start + timedelta(hours=shift * 4)
                    end_time = start_time + timedelta(hours=4)
                    duration_s = 4 * 3600

                    # Decide state
                    r_val = random.random()
                    if asset["degrading"] and day_offset <= 2 and r_val < 0.25:
                        state = "DOWN"
                        reason = "BEARING_VIBRATION_SPIKE"
                        good = 0
                        reject = 0
                    elif r_val < (1.0 - pcfg["avail_rate"]):
                        state = "IDLE" if r_val < (1.0 - pcfg["avail_rate"]) / 2 else "SETUP"
                        reason = "TOOL_CHANGEOVER" if state == "SETUP" else "STARVATION"
                        good = 0
                        reject = 0
                    else:
                        state = "RUNNING"
                        reason = "NORMAL_PRODUCTION"
                        # Parts produced
                        ideal_parts = int(duration_s / asset["cycle_s"])
                        actual_parts = int(ideal_parts * pcfg["perf_factor"] * (0.98 + random.random() * 0.04))
                        reject = int(actual_parts * pcfg["scrap_rate"])
                        good = actual_parts - reject

                    rows.append({
                        "ts_start": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                        "ts_end": end_time.strftime("%Y-%m-%d %H:%M:%S"),
                        "plant_id": pid,
                        "asset_id": aid,
                        "state": state,
                        "reason_code": reason,
                        "production_order_id": f"PO-{pid}-{start_time.strftime('%Y%m%d%H')}",
                        "sku_id": asset["sku"],
                        "good_count": good,
                        "reject_count": reject,
                        "ideal_cycle_s": asset["cycle_s"]
                    })

    # Insert into BQ
    errors = client.insert_rows_json(table_id, rows)
    if errors:
        print(f"Errors inserting machine_states: {errors}")
    else:
        print(f"Successfully inserted {len(rows)} machine state slices into {table_id}.")


def seed_telemetry_1m():
    table_id = f"{PROJECT_ID}.silver.telemetry_1m"
    print(f"Seeding {table_id}...")

    try:
        client.query(f"DELETE FROM `{table_id}` WHERE ts_min > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)").result()
    except Exception as e:
        print(f"Notice during delete: {e}")

    now = datetime.utcnow()
    rows = []

    # 48 hours of 15-minute telemetry intervals for key assets
    assets = [
        {"id": "PNQ-CNC-07", "plant": "PNQ", "line": "PNQ-L1", "degrading": True},
        {"id": "PNQ-CNC-08", "plant": "PNQ", "line": "PNQ-L1", "degrading": False},
        {"id": "RYG-DC-01", "plant": "RYG", "line": "RYG-L1", "degrading": False},
        {"id": "NGO-GR-01", "plant": "NGO", "line": "NGO-L1", "degrading": False}
    ]

    for asset in assets:
        for hour_offset in range(48, 0, -1):
            t = now - timedelta(hours=hour_offset)
            
            # Baseline vibration
            if asset["degrading"]:
                # Climbing from 1.2 mm/s up to 2.82 mm/s
                progress = (48 - hour_offset) / 48.0
                vib_mean = 1.2 + (1.62 * progress) + (random.random() * 0.1 - 0.05)
                temp_mean = 42.0 + (18.0 * progress) + (random.random() * 2.0)
            else:
                vib_mean = 1.15 + (random.random() * 0.1)
                temp_mean = 41.0 + (random.random() * 1.5)

            rows.append({
                "ts_min": t.strftime("%Y-%m-%d %H:%M:%S"),
                "sim_ts_min": t.strftime("%Y-%m-%d %H:%M:%S"),
                "plant_id": asset["plant"],
                "line_id": asset["line"],
                "asset_id": asset["id"],
                "metric": "vib_rms",
                "avg_value": round(vib_mean, 2),
                "min_value": round(vib_mean - 0.1, 2),
                "max_value": round(vib_mean + 0.15, 2),
                "std_value": 0.05,
                "n": 60
            })
            rows.append({
                "ts_min": t.strftime("%Y-%m-%d %H:%M:%S"),
                "sim_ts_min": t.strftime("%Y-%m-%d %H:%M:%S"),
                "plant_id": asset["plant"],
                "line_id": asset["line"],
                "asset_id": asset["id"],
                "metric": "temp_c",
                "avg_value": round(temp_mean, 1),
                "min_value": round(temp_mean - 1.0, 1),
                "max_value": round(temp_mean + 1.2, 1),
                "std_value": 0.4,
                "n": 60
            })

    errors = client.insert_rows_json(table_id, rows)
    if errors:
        print(f"Errors inserting telemetry_1m: {errors}")
    else:
        print(f"Successfully inserted {len(rows)} telemetry aggregates into {table_id}.")


def seed_inspections():
    table_id = f"{PROJECT_ID}.silver.inspections"
    print(f"Seeding {table_id}...")

    try:
        client.query(f"DELETE FROM `{table_id}` WHERE ts > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)").result()
    except Exception as e:
        print(f"Notice during delete: {e}")

    now = datetime.utcnow()
    rows = []

    # Seeding Rayong porosity defect images & Pune inspections
    for i in range(30):
        t = now - timedelta(hours=i * 2)
        is_porosity = (i % 6 == 0) # elevated defect cluster in RYG
        rows.append({
            "inspection_id": f"insp_ryg_{1000 + i}",
            "ts": t.strftime("%Y-%m-%d %H:%M:%S"),
            "plant_id": "RYG",
            "asset_id": "RYG-DC-01",
            "lot_id": f"LOT-RYG-08{i:02d}",
            "sku_id": "INV-200",
            "stage": "EOL_INSPECTION",
            "model_id": "gemini-2.0-flash-vision",
            "is_defect": is_porosity,
            "defect_type": "surface_porosity" if is_porosity else "none",
            "severity": "high" if is_porosity else "none",
            "confidence": 0.94 if is_porosity else 0.99,
            "human_label": "confirmed_defect" if is_porosity else "pass"
        })

    errors = client.insert_rows_json(table_id, rows)
    if errors:
        print(f"Errors inserting inspections: {errors}")
    else:
        print(f"Successfully inserted {len(rows)} inspection records into {table_id}.")


if __name__ == "__main__":
    seed_machine_states()
    seed_telemetry_1m()
    seed_inspections()
    print("All operational BigQuery fact tables seeded successfully!")

