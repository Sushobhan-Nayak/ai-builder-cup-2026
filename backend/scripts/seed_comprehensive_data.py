"""
Seed Comprehensive Enterprise Dataset for GembaOS into Google BigQuery:
- silver.machine_states: 14 days of shift state logs across all 11 assets (PNQ, RYG, NGO)
- silver.telemetry_1m: 72 hours of multi-sensor telemetry (vib_rms, temp_c, current_a, spindle_load_pct)
- silver.inspections: 150+ optical/vision defect logs with bounding boxes, rationales, and lots
- silver.inventory: 20 warehouse stock records across Pune, Rayong, and Nagoya
"""

import os
import json
import random
from datetime import datetime, timedelta
from google.cloud import bigquery

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "deep-atlas-511314-r4")
client = bigquery.Client(project=PROJECT_ID)

ALL_ASSETS = [
    # Pune Plant (PNQ) - e-Powertrain Assembly & CNC Machining
    {"id": "PNQ-CNC-07", "plant": "PNQ", "line": "PNQ-L1", "sku": "TM-300", "cycle_s": 45.0, "degrading": True, "type": "cnc"},
    {"id": "PNQ-CNC-08", "plant": "PNQ", "line": "PNQ-L1", "sku": "TM-300", "cycle_s": 45.0, "degrading": False, "type": "cnc"},
    {"id": "PNQ-CNC-09", "plant": "PNQ", "line": "PNQ-L1", "sku": "TM-400", "cycle_s": 50.0, "degrading": False, "type": "cnc"},
    {"id": "PNQ-ASM-01", "plant": "PNQ", "line": "PNQ-L2", "sku": "TM-300", "cycle_s": 90.0, "degrading": False, "type": "assembly"},
    {"id": "PNQ-ASM-02", "plant": "PNQ", "line": "PNQ-L2", "sku": "TM-400", "cycle_s": 95.0, "degrading": False, "type": "assembly"},

    # Rayong Plant (RYG) - High-Pressure Die Casting & Housing Finish
    {"id": "RYG-DC-01",  "plant": "RYG", "line": "RYG-L1", "sku": "INV-200", "cycle_s": 32.0, "degrading": False, "type": "casting", "porosity_risk": True},
    {"id": "RYG-DC-02",  "plant": "RYG", "line": "RYG-L1", "sku": "INV-250", "cycle_s": 35.0, "degrading": False, "type": "casting"},
    {"id": "RYG-CNC-03", "plant": "RYG", "line": "RYG-L2", "sku": "INV-200", "cycle_s": 40.0, "degrading": False, "type": "cnc"},
    {"id": "RYG-PNT-01", "plant": "RYG", "line": "RYG-L2", "sku": "INV-200", "cycle_s": 60.0, "degrading": False, "type": "paint"},

    # Nagoya Plant (NGO) - High-Precision Gears & Induction Heat Treating
    {"id": "NGO-GR-01",  "plant": "NGO", "line": "NGO-L1", "sku": "AXLE-100", "cycle_s": 60.0, "degrading": False, "type": "grinder"},
    {"id": "NGO-GR-02",  "plant": "NGO", "line": "NGO-L1", "sku": "AXLE-100", "cycle_s": 60.0, "degrading": False, "type": "grinder"},
    {"id": "NGO-FUR-01", "plant": "NGO", "line": "NGO-L2", "sku": "GEAR-SET-01", "cycle_s": 120.0, "degrading": False, "type": "furnace"},
    {"id": "NGO-FUR-02", "plant": "NGO", "line": "NGO-L2", "sku": "GEAR-SET-01", "cycle_s": 120.0, "degrading": False, "type": "furnace"},
]


def seed_machine_states():
    table_id = f"{PROJECT_ID}.silver.machine_states"
    print(f"\n--- Seeding {table_id} ---")

    try:
        client.query(f"DELETE FROM `{table_id}` WHERE ts_start > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 21 DAY)").result()
        print("Cleared previous machine_states.")
    except Exception as e:
        print(f"Notice during delete: {e}")

    now = datetime.utcnow()
    rows = []

    # Plant specific parameters
    plant_metrics = {
        "PNQ": {"avail": 0.86, "perf": 0.92, "scrap": 0.017},
        "RYG": {"avail": 0.88, "perf": 0.94, "scrap": 0.045}, # Elevated casting scrap
        "NGO": {"avail": 0.97, "perf": 0.97, "scrap": 0.004}, # Lean benchmark
    }

    # 14 days of 4-hour production slices for each of the 13 assets
    for asset in ALL_ASSETS:
        pid = asset["plant"]
        pcfg = plant_metrics[pid]
        aid = asset["id"]

        for day_offset in range(14, 0, -1):
            day_start = now - timedelta(days=day_offset)
            for shift in range(6):  # 6 x 4-hour slots per 24 hours
                start_time = day_start + timedelta(hours=shift * 4)
                end_time = start_time + timedelta(hours=4)
                duration_s = 4 * 3600

                r_val = random.random()

                # Simulated degradation downtime on CNC-07 in last 3 days
                if asset.get("degrading") and day_offset <= 3 and r_val < 0.28:
                    state = "DOWN"
                    reason = "BEARING_VIBRATION_SPIKE"
                    good = 0
                    reject = 0
                elif r_val < (1.0 - pcfg["avail"]):
                    if r_val < (1.0 - pcfg["avail"]) * 0.5:
                        state = "IDLE"
                        reason = "FEED_STARVATION" if pid == "PNQ" else "DIE_LUBRICATION"
                    else:
                        state = "SETUP"
                        reason = "TOOL_CHANGEOVER" if "CNC" in aid else "SCHEDULED_CLEANING"
                    good = 0
                    reject = 0
                else:
                    state = "RUNNING"
                    reason = "NORMAL_PRODUCTION"
                    ideal_parts = int(duration_s / asset["cycle_s"])
                    actual_parts = int(ideal_parts * pcfg["perf"] * (0.97 + random.random() * 0.05))
                    scrap_rate = pcfg["scrap"] * (1.5 if asset.get("porosity_risk") else 1.0)
                    reject = int(actual_parts * scrap_rate)
                    good = actual_parts - reject

                rows.append({
                    "ts_start": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "ts_end": end_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "plant_id": pid,
                    "asset_id": aid,
                    "state": state,
                    "reason_code": reason,
                    "production_order_id": f"PO-{pid}-{start_time.strftime('%y%m%d')}-{shift+1}",
                    "sku_id": asset["sku"],
                    "good_count": good,
                    "reject_count": reject,
                    "ideal_cycle_s": float(asset["cycle_s"])
                })

    # Chunk insert
    chunk_size = 500
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i + chunk_size]
        errs = client.insert_rows_json(table_id, chunk)
        if errs:
            print(f"Error inserting chunk {i}: {errs}")
    print(f"Total inserted {len(rows)} machine state slices into {table_id}.")


def seed_telemetry_1m():
    table_id = f"{PROJECT_ID}.silver.telemetry_1m"
    print(f"\n--- Seeding {table_id} ---")

    try:
        client.query(f"DELETE FROM `{table_id}` WHERE ts_min > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 DAY)").result()
        print("Cleared previous telemetry_1m.")
    except Exception as e:
        print(f"Notice during delete: {e}")

    now = datetime.utcnow()
    rows = []

    # 72 hours of telemetry at 1-hour intervals across all 13 assets
    # (Generating multi-metric streams: vib_rms, temp_c, current_a)
    for asset in ALL_ASSETS:
        aid = asset["id"]
        pid = asset["plant"]
        lid = asset["line"]
        is_deg = asset.get("degrading", False)

        for hour_offset in range(72, 0, -1):
            t = now - timedelta(hours=hour_offset)
            ts_str = t.strftime("%Y-%m-%d %H:%M:%S")

            # 1. Vibration RMS
            if is_deg:
                # Progressive rise from 1.15 mm/s to 2.85 mm/s
                prog = (72 - hour_offset) / 72.0
                vib_val = 1.15 + (1.65 * prog) + (random.random() * 0.12 - 0.06)
            elif asset["type"] == "casting":
                vib_val = 0.85 + (random.random() * 0.15)
            elif asset["type"] == "furnace":
                vib_val = 0.40 + (random.random() * 0.08)
            else:
                vib_val = 1.10 + (random.random() * 0.12)

            rows.append({
                "ts_min": ts_str,
                "sim_ts_min": ts_str,
                "plant_id": pid,
                "line_id": lid,
                "asset_id": aid,
                "metric": "vib_rms",
                "avg_value": round(vib_val, 2),
                "min_value": round(vib_val - 0.10, 2),
                "max_value": round(vib_val + 0.14, 2),
                "std_value": 0.04,
                "n": 60
            })

            # 2. Temperature °C
            if is_deg:
                temp_val = 42.0 + (19.0 * prog) + (random.random() * 1.5)
            elif asset["type"] == "furnace":
                temp_val = 840.0 + (random.random() * 25.0) # Induction zone
            elif asset["type"] == "casting":
                temp_val = 665.0 + (random.random() * 18.0) # Molten aluminum die
            else:
                temp_val = 41.5 + (random.random() * 2.2)

            rows.append({
                "ts_min": ts_str,
                "sim_ts_min": ts_str,
                "plant_id": pid,
                "line_id": lid,
                "asset_id": aid,
                "metric": "temp_c",
                "avg_value": round(temp_val, 1),
                "min_value": round(temp_val - 1.2, 1),
                "max_value": round(temp_val + 1.5, 1),
                "std_value": 0.35,
                "n": 60
            })

            # 3. Motor Current (Amperes) / Load
            if asset["type"] == "furnace":
                curr_val = 320.0 + (random.random() * 20.0)
            elif "CNC" in aid or "GR" in aid:
                curr_val = 24.5 + (random.random() * 3.5)
            else:
                curr_val = 15.0 + (random.random() * 2.0)

            rows.append({
                "ts_min": ts_str,
                "sim_ts_min": ts_str,
                "plant_id": pid,
                "line_id": lid,
                "asset_id": aid,
                "metric": "current_a",
                "avg_value": round(curr_val, 1),
                "min_value": round(curr_val - 2.0, 1),
                "max_value": round(curr_val + 2.5, 1),
                "std_value": 0.6,
                "n": 60
            })

    # Chunk insert
    chunk_size = 500
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i + chunk_size]
        errs = client.insert_rows_json(table_id, chunk)
        if errs:
            print(f"Error inserting chunk {i}: {errs}")
    print(f"Total inserted {len(rows)} telemetry points into {table_id}.")


def seed_inspections():
    table_id = f"{PROJECT_ID}.silver.inspections"
    print(f"\n--- Seeding {table_id} ---")

    try:
        client.query(f"DELETE FROM `{table_id}` WHERE ts > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)").result()
        print("Cleared previous inspections.")
    except Exception as e:
        print(f"Notice during delete: {e}")

    now = datetime.utcnow()
    rows = []

    # 150 diverse quality inspections across all three plants
    defect_scenarios = [
        {"plant": "RYG", "asset": "RYG-DC-01", "sku": "INV-200", "defect": "surface_porosity", "prob": 0.18, "stage": "CASTING_POST_COOLING"},
        {"plant": "RYG", "asset": "RYG-CNC-03", "sku": "INV-200", "defect": "burr_exceedance", "prob": 0.08, "stage": "EDGE_DEBURR"},
        {"plant": "PNQ", "asset": "PNQ-CNC-07", "sku": "TM-300", "defect": "chatter_marks", "prob": 0.12, "stage": "BEARING_JOURNAL_FINISH"},
        {"plant": "PNQ", "asset": "PNQ-ASM-02", "sku": "TM-300", "defect": "hairpin_alignment", "prob": 0.04, "stage": "STATOR_INSERTION"},
        {"plant": "NGO", "asset": "NGO-GR-01",  "sku": "AXLE-100", "defect": "micro_crack", "prob": 0.02, "stage": "GEAR_TOOTH_OPTICAL"},
    ]

    for i in range(160):
        t = now - timedelta(hours=i * 2)
        scen = defect_scenarios[i % len(defect_scenarios)]
        is_def = random.random() < scen["prob"]
        defect_type = scen["defect"] if is_def else "none"

        bboxes = None
        rationale = "Component meets dimensional geometry and surface roughness tolerances."
        if is_def:
            ymin, xmin = round(random.uniform(0.2, 0.6), 2), round(random.uniform(0.2, 0.6), 2)
            ymax, xmax = round(ymin + random.uniform(0.1, 0.25), 2), round(xmin + random.uniform(0.1, 0.25), 2)
            bboxes = json.dumps([{"box_2d": [ymin, xmin, ymax, xmax], "label": defect_type}])
            rationale = f"Detected {defect_type} anomaly exceeding ISO 1302 class 3 threshold."

        rows.append({
            "inspection_id": f"insp_{scen['plant'].lower()}_{1000 + i}",
            "ts": t.strftime("%Y-%m-%d %H:%M:%S"),
            "plant_id": scen["plant"],
            "asset_id": scen["asset"],
            "lot_id": f"LOT-{scen['plant']}-{t.strftime('%y%m%d')}-{i % 10:02d}",
            "sku_id": scen["sku"],
            "image_ref": None,
            "stage": scen["stage"],
            "model_id": "gemini-2.0-flash-vision",
            "is_defect": is_def,
            "defect_type": defect_type,
            "severity": "high" if (is_def and "crack" in defect_type or "porosity" in defect_type) else ("medium" if is_def else "none"),
            "confidence": round(0.92 + random.random() * 0.07, 2),
            "bboxes": bboxes,
            "rationale": rationale,
            "human_label": "confirmed_defect" if is_def else "pass",
            "labeled_by": "qa_inspector_02" if is_def else "auto_classifier"
        })

    chunk_size = 500
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i + chunk_size]
        errs = client.insert_rows_json(table_id, chunk)
        if errs:
            print(f"Error inserting chunk {i}: {errs}")
    print(f"Total inserted {len(rows)} inspection records into {table_id}.")


def seed_inventory():
    table_id = f"{PROJECT_ID}.silver.inventory"
    print(f"\n--- Seeding {table_id} ---")

    try:
        client.query(f"DELETE FROM `{table_id}` WHERE 1=1").result()
        print("Cleared previous inventory.")
    except Exception as e:
        print(f"Notice during delete: {e}")

    now = datetime.utcnow()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

    # 20 distinct inventory items across PNQ, RYG, NGO
    items = [
        # Pune (PNQ)
        {"plant_id": "PNQ", "part_id": "BRG-6205", "stock_qty": 14, "reserved_qty": 2, "location_bin": "PNQ-A01-04"},
        {"plant_id": "PNQ", "part_id": "BRG-7208", "stock_qty": 8, "reserved_qty": 0, "location_bin": "PNQ-A01-05"},
        {"plant_id": "PNQ", "part_id": "INS-CNMG-12", "stock_qty": 45, "reserved_qty": 5, "location_bin": "PNQ-B02-11"},
        {"plant_id": "PNQ", "part_id": "SEAL-VITON-50", "stock_qty": 24, "reserved_qty": 0, "location_bin": "PNQ-A03-02"},
        {"plant_id": "PNQ", "part_id": "IC-GD-01", "stock_qty": 180, "reserved_qty": 50, "location_bin": "PNQ-E01-08"},
        {"plant_id": "PNQ", "part_id": "ROTOR-CORE-300", "stock_qty": 85, "reserved_qty": 20, "location_bin": "PNQ-C01-01"},
        {"plant_id": "PNQ", "part_id": "STATOR-CASING-300", "stock_qty": 65, "reserved_qty": 15, "location_bin": "PNQ-C02-03"},

        # Rayong (RYG)
        {"plant_id": "RYG", "part_id": "AL-A380-INGOT", "stock_qty": 22, "reserved_qty": 4, "location_bin": "RYG-RAW-01"},
        {"plant_id": "RYG", "part_id": "MOLD-DIE-INV200", "stock_qty": 2, "reserved_qty": 0, "location_bin": "RYG-TOOL-04"},
        {"plant_id": "RYG", "part_id": "FLUX-DEGASS-01", "stock_qty": 60, "reserved_qty": 10, "location_bin": "RYG-CHEM-02"},
        {"plant_id": "RYG", "part_id": "PNT-EPOXY-BLK", "stock_qty": 18, "reserved_qty": 3, "location_bin": "RYG-PNT-01"},
        {"plant_id": "RYG", "part_id": "HYD-PUMP-REXROTH", "stock_qty": 3, "reserved_qty": 1, "location_bin": "RYG-MNT-03"},
        {"plant_id": "RYG", "part_id": "FILTER-HYD-10U", "stock_qty": 30, "reserved_qty": 2, "location_bin": "RYG-MNT-04"},
        {"plant_id": "RYG", "part_id": "IC-GD-01", "stock_qty": 120, "reserved_qty": 40, "location_bin": "RYG-E02-01"},

        # Nagoya (NGO)
        {"plant_id": "NGO", "part_id": "GR-WHEEL-CBN-300", "stock_qty": 6, "reserved_qty": 1, "location_bin": "NGO-TOOL-02"},
        {"plant_id": "NGO", "part_id": "STEEL-SCM420H", "stock_qty": 340, "reserved_qty": 60, "location_bin": "NGO-RAW-03"},
        {"plant_id": "NGO", "part_id": "COOLANT-SYNTH-50L", "stock_qty": 16, "reserved_qty": 2, "location_bin": "NGO-CHEM-01"},
        {"plant_id": "NGO", "part_id": "THERMO-TYPE-K", "stock_qty": 10, "reserved_qty": 0, "location_bin": "NGO-MNT-01"},
        {"plant_id": "NGO", "part_id": "INDUCTION-COIL-01", "stock_qty": 4, "reserved_qty": 0, "location_bin": "NGO-MNT-02"},
        {"plant_id": "NGO", "part_id": "PINION-BLANK-42", "stock_qty": 210, "reserved_qty": 35, "location_bin": "NGO-RAW-05"},
    ]

    for item in items:
        item["last_updated"] = now_str

    errs = client.insert_rows_json(table_id, items)
    if errs:
        print(f"Error inserting inventory: {errs}")
    else:
        print(f"Total inserted {len(items)} spare parts inventory rows into {table_id}.")


if __name__ == "__main__":
    seed_machine_states()
    seed_telemetry_1m()
    seed_inspections()
    seed_inventory()
    print("\n>>> All Comprehensive Enterprise Datasets Seeded Successfully! <<<")

