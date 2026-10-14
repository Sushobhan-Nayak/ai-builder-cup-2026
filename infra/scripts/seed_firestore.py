import os
import sys
import logging
from pathlib import Path
from datetime import datetime, timedelta

# Ensure repo root is on sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.packages.gembaos_core.clients import get_firestore_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_firestore():
    fs = get_firestore_client()
    now = datetime.utcnow()
    logger.info(f"Seeding Firestore real-time state in project {fs.project}...")

    # 1. Plants collection
    plants_data = {
        "PNQ": {
            "plant_id": "PNQ",
            "name": "Pune Plant",
            "location": "Pune, India",
            "plant_ids": ["PNQ"],
            "kpis": {
                "oee_pct": 78.4,
                "oee_trend": "-1.2%",
                "otif_pct": 94.2,
                "mtbf_hours": 142.0,
                "mttr_hours": 2.4,
                "co2_intensity_kg": 18.2
            },
            "status": "ATTENTION_REQUIRED",
            "active_anomalies": 1,
            "last_updated": now.isoformat()
        },
        "RYG": {
            "plant_id": "RYG",
            "name": "Rayong Plant",
            "location": "Rayong, Thailand",
            "plant_ids": ["RYG"],
            "kpis": {
                "oee_pct": 82.1,
                "oee_trend": "+0.4%",
                "otif_pct": 96.5,
                "mtbf_hours": 188.0,
                "mttr_hours": 1.9,
                "co2_intensity_kg": 14.6
            },
            "status": "NORMAL",
            "active_anomalies": 0,
            "last_updated": now.isoformat()
        },
        "NGO": {
            "plant_id": "NGO",
            "name": "Nagoya Plant",
            "location": "Nagoya, Japan",
            "plant_ids": ["NGO"],
            "kpis": {
                "oee_pct": 86.3,
                "oee_trend": "+1.1%",
                "otif_pct": 99.1,
                "mtbf_hours": 310.0,
                "mttr_hours": 1.2,
                "co2_intensity_kg": 9.8
            },
            "status": "NORMAL",
            "active_anomalies": 0,
            "last_updated": now.isoformat()
        }
    }

    for p_id, p_doc in plants_data.items():
        fs.collection("plants").document(p_id).set(p_doc)
        logger.info(f"Seeded plant: {p_id}")

    # 2. Live Asset (PNQ-CNC-07)
    cnc07_doc = {
        "asset_id": "PNQ-CNC-07",
        "plant_id": "PNQ",
        "line_id": "PNQ-L1",
        "name": "CNC Milling Center 07",
        "status": "DEGRADING",
        "health_score": 62,
        "criticality": "CRITICAL",
        "failure_mode": "Outer-race bearing spalling (Drive-End)",
        "rul_hours": {
            "p10": 26.5,
            "p50": 34.0,
            "p90": 48.0
        },
        "metrics": {
            "vib_rms": 2.82,
            "vib_kurtosis": 4.31,
            "temperature_c": 54.2,
            "spindle_load_pct": 82.0
        },
        "recommended_window": "Thursday 14:00 (PM shift)",
        "required_parts": ["BRG-6205"],
        "parts_available": True,
        "last_updated": now.isoformat()
    }
    fs.collection("plants").document("PNQ").collection("assets").document("PNQ-CNC-07").set(cnc07_doc)
    logger.info("Seeded live asset: PNQ-CNC-07")

    # 3. Value Ledger Summary (GEMBAOS_SPEC.md 9.7 & 18.2)
    ledger_doc = {
        "value_protected_usd": 2410000.0,
        "downtime_hours_avoided": 31.0,
        "co2_avoided_tons": 18.2,
        "currency": "USD",
        "period": "Q3 2026 (Simulated)",
        "active_safeguards": 14,
        "last_updated": now.isoformat()
    }
    fs.collection("valueLedger").document("summary").set(ledger_doc)
    logger.info("Seeded Value Ledger summary")

    # 4. Insights Feed
    insights = [
        {
            "id": "ins_anom_cnc07",
            "ts": (now - timedelta(minutes=14)).isoformat(),
            "plant_ids": ["PNQ"],
            "domain": "maintenance",
            "severity": "high",
            "title": "CNC-07 Drive-End Bearing Spalling Detected",
            "summary": "RMS vibration breach 2.82 mm/s with 82% confidence of outer-race fatigue. P10 RUL is 26.5 hours.",
            "entities": [{"type": "asset", "id": "PNQ-CNC-07"}],
            "confidence": 0.88,
            "impact": {"usd": 50000.0, "downtime_h": 4.0, "co2_kg": 0.0},
            "evidence_ids": ["ev_sql_101", "ev_opt_1"],
            "agent": "sentinel",
            "status": "new"
        },
        {
            "id": "ins_wth_haikui",
            "ts": (now - timedelta(minutes=28)).isoformat(),
            "plant_ids": ["PNQ", "RYG", "NGO"],
            "domain": "supply",
            "severity": "critical",
            "title": "Typhoon Haikui-2 Warning — Formosa Supplier Disruption",
            "summary": "Category 4 typhoon landfall near Hsinchu within 48h. Supplier Formosa disrupted, impacting stator supply for TM-300.",
            "entities": [{"type": "supplier", "id": "SUP-FORMOSA"}, {"type": "sku", "id": "TM-300"}],
            "confidence": 0.95,
            "impact": {"usd": 793500.0, "downtime_h": 0.0, "co2_kg": 4600.0},
            "evidence_ids": ["ev_gql_blast", "ev_sql_alt"],
            "agent": "scout",
            "status": "new"
        }
    ]
    for ins in insights:
        fs.collection("insights").document(ins["id"]).set(ins)
        logger.info(f"Seeded insight: {ins['id']}")

    # 5. User Profile
    user_doc = {
        "uid": "usr_ops_lead_01",
        "name": "Sarah Chen",
        "email": "sarah.chen@novadrive.com",
        "role": "Plant Director",
        "roles": ["plant_manager", "maintenance", "buyer", "planner"],
        "plants": ["PNQ", "RYG", "NGO"],
        "language": "en",
        "preferences": {
            "theme": "dark",
            "audio_alerts": True,
            "currency": "USD"
        }
    }
    fs.collection("users").document("usr_ops_lead_01").set(user_doc)
    logger.info("Seeded user profile: usr_ops_lead_01")

    logger.info("=== Firestore Real-Time State Seeding Complete! ===")

if __name__ == "__main__":
    seed_firestore()
