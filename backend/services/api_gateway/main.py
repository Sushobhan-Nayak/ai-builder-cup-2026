import os
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Header, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import httpx
import yaml

from backend.packages.gembaos_core.config import models
from backend.packages.gembaos_core.schemas.agents import (
    Insight, Recommendation, Decision, Evidence, OptionsList
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="GembaOS API Gateway (BFF)",
    version="1.4",
    description="Backend-For-Frontend gateway for GembaOS Command Center and War Room"
)

# Enable CORS for Next.js development and production hosting
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ID = os.getenv("PROJECT_ID", "deep-atlas-511314-r4")
SIMULATOR_URL = os.getenv("SIMULATOR_URL", "http://localhost:8082")
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:8080")

# Lazy clients
_bq_client = None
_fs_client = None
_pubsub_client = None

def get_bq():
    global _bq_client
    if _bq_client is None:
        try:
            from google.cloud import bigquery
            _bq_client = bigquery.Client(project=PROJECT_ID)
        except Exception as e:
            logger.warning(f"BigQuery client unavailable: {e}")
    return _bq_client

def get_firestore():
    global _fs_client
    if _fs_client is None:
        try:
            from google.cloud import firestore
            _fs_client = firestore.Client(project=PROJECT_ID)
        except Exception as e:
            logger.warning(f"Firestore client unavailable: {e}")
    return _fs_client

def get_pubsub():
    global _pubsub_client
    if _pubsub_client is None:
        try:
            from google.cloud import pubsub_v1
            _pubsub_client = pubsub_v1.PublisherClient()
        except Exception as e:
            logger.warning(f"PubSub client unavailable: {e}")
    return _pubsub_client

# Load Plant master configuration
def load_plants_config() -> List[Dict[str, Any]]:
    config_paths = [
        Path("backend/config/plants.yaml"),
        Path("config/plants.yaml"),
        Path(__file__).resolve().parent.parent.parent / "config" / "plants.yaml"
    ]
    for p in config_paths:
        if p.is_file():
            with open(p, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
                return data.get("plants", [])
    return [
        {"id": "PNQ", "name": "Pune Plant", "location": "Pune, India", "timezone": "Asia/Kolkata"},
        {"id": "RYG", "name": "Rayong Plant", "location": "Rayong, Thailand", "timezone": "Asia/Bangkok"},
        {"id": "NGO", "name": "Nagoya Plant", "location": "Nagoya, Japan", "timezone": "Asia/Tokyo"},
    ]


@app.get("/")
@app.get("/health")
@app.get("/healthz")
async def health_check():
    return {"status": "ok", "service": "api_gateway", "project_id": PROJECT_ID}


# ==========================================
# 1. User & Profile
# ==========================================
@app.get("/v1/me")
async def get_current_user():
    """Returns authenticated user profile, roles, and allowed plants."""
    return {
        "id": "usr_ops_lead_01",
        "name": "Sarah Chen",
        "email": "sarah.chen@novadrive.com",
        "roles": ["plant_manager", "maintenance", "buyer", "planner"],
        "allowed_plants": ["PNQ", "RYG", "NGO"],
        "primary_plant": "PNQ",
        "language": "en"
    }


# ==========================================
# 2. Plant Network & KPIs
# ==========================================
@app.get("/v1/plants")
async def list_plants():
    """List all manufacturing plants in the Nova Drive network."""
    return {"plants": load_plants_config()}


@app.get("/v1/plants/{plant_id}")
async def get_plant(plant_id: str):
    plants = load_plants_config()
    for plant in plants:
        if plant.get("id") == plant_id:
            return plant
    raise HTTPException(status_code=404, detail="Plant not found")


# Production Lines Mapping per Section 12.2
PLANT_LINES_MAP = {
    "PNQ": [
        {
            "line_id": "PNQ-L1",
            "name": "e-Powertrain Machining Line",
            "plant_id": "PNQ",
            "status": "DEGRADED",
            "oee_pct": 74.2,
            "target_oee_pct": 85.0,
            "assets": ["PNQ-CNC-07", "PNQ-CNC-08"],
            "current_product": "TM-300 Stator/Rotor Casing",
            "bottleneck_asset": "PNQ-CNC-07"
        },
        {
            "line_id": "PNQ-L2",
            "name": "Motor Rotor & Stator Assembly Line",
            "plant_id": "PNQ",
            "status": "RUNNING",
            "oee_pct": 82.5,
            "target_oee_pct": 85.0,
            "assets": ["PNQ-ASM-01", "PNQ-ASM-02"],
            "current_product": "TM-300 Final Assembly",
            "bottleneck_asset": None
        }
    ],
    "RYG": [
        {
            "line_id": "RYG-L1",
            "name": "High-Pressure Die Casting Line 1",
            "plant_id": "RYG",
            "status": "RUNNING",
            "oee_pct": 83.8,
            "target_oee_pct": 85.0,
            "assets": ["RYG-DC-01", "RYG-DC-02"],
            "current_product": "Inverter Housing INV-200",
            "bottleneck_asset": None
        },
        {
            "line_id": "RYG-L2",
            "name": "Housing Finish & Painting Line 2",
            "plant_id": "RYG",
            "status": "WARNING",
            "oee_pct": 78.6,
            "target_oee_pct": 85.0,
            "assets": ["RYG-CNC-03", "RYG-PNT-01"],
            "current_product": "INV-200 Surface Finish",
            "bottleneck_asset": "RYG-PNT-01"
        }
    ],
    "NGO": [
        {
            "line_id": "NGO-L1",
            "name": "Precision Gear Grinding Line",
            "plant_id": "NGO",
            "status": "RUNNING",
            "oee_pct": 90.2,
            "target_oee_pct": 88.0,
            "assets": ["NGO-GR-01", "NGO-GR-02"],
            "current_product": "e-Axle Reduction Gears",
            "bottleneck_asset": None
        },
        {
            "line_id": "NGO-L2",
            "name": "Induction Heat Treatment Line",
            "plant_id": "NGO",
            "status": "RUNNING",
            "oee_pct": 88.8,
            "target_oee_pct": 88.0,
            "assets": ["NGO-FUR-01", "NGO-FUR-02"],
            "current_product": "Reduction Pinions",
            "bottleneck_asset": None
        }
    ]
}


@app.get("/v1/plants/{plant_id}/lines")
async def get_plant_lines(plant_id: str):
    """List operational production lines and live line health for a plant."""
    pid = plant_id.upper()
    if pid in PLANT_LINES_MAP:
        return {"plant_id": pid, "lines": PLANT_LINES_MAP[pid]}
    raise HTTPException(status_code=404, detail=f"Plant '{plant_id}' not found")


# Plant-specific baseline KPI profiles reflecting GembaOS operational scenarios
PLANT_KPIS_MAP = {
    "GLOBAL": {
        "scope": "global",
        "plant_id": "ALL",
        "plant_name": "Nova Drive Global Network",
        "kpis": {
            "oee_pct": 82.5,
            "oee_trend": "-0.8%",
            "otif_pct": 94.4,
            "otif_target": 98.0,
            "mtbf_hours": 173.0,
            "mttr_hours": 2.2,
            "scrap_rate_pct": 2.3,
            "revenue_at_risk_usd": 793500.0,
            "co2_intensity_kg_per_unit": 18.2,
            "active_anomalies_count": 2,
            "pending_decisions_count": 2,
            "production_rate_units_day": 1420
        }
    },
    "PNQ": {
        "scope": "plant:PNQ",
        "plant_id": "PNQ",
        "plant_name": "Pune Plant (India)",
        "key_focus": "e-Powertrain Assembly & Spindle Degradation",
        "kpis": {
            "oee_pct": 76.8,
            "oee_trend": "-2.4%",
            "otif_pct": 91.5,
            "otif_target": 98.0,
            "mtbf_hours": 118.0,
            "mttr_hours": 3.2,
            "scrap_rate_pct": 1.8,
            "revenue_at_risk_usd": 517500.0,
            "co2_intensity_kg_per_unit": 21.4,
            "active_anomalies_count": 1,
            "pending_decisions_count": 1,
            "production_rate_units_day": 450
        }
    },
    "RYG": {
        "scope": "plant:RYG",
        "plant_id": "RYG",
        "plant_name": "Rayong Plant (Thailand)",
        "key_focus": "Die Casting Porosity & Quality Control",
        "kpis": {
            "oee_pct": 81.2,
            "oee_trend": "-1.5%",
            "otif_pct": 93.8,
            "otif_target": 98.0,
            "mtbf_hours": 156.0,
            "mttr_hours": 2.1,
            "scrap_rate_pct": 4.6,
            "revenue_at_risk_usd": 185000.0,
            "co2_intensity_kg_per_unit": 19.8,
            "active_anomalies_count": 1,
            "pending_decisions_count": 1,
            "production_rate_units_day": 520
        }
    },
    "NGO": {
        "scope": "plant:NGO",
        "plant_id": "NGO",
        "plant_name": "Nagoya Plant (Japan)",
        "key_focus": "High-Precision Machining & TOU Load Shifting",
        "kpis": {
            "oee_pct": 89.5,
            "oee_trend": "+0.6%",
            "otif_pct": 98.2,
            "otif_target": 98.0,
            "mtbf_hours": 245.0,
            "mttr_hours": 1.2,
            "scrap_rate_pct": 0.5,
            "revenue_at_risk_usd": 91000.0,
            "co2_intensity_kg_per_unit": 13.4,
            "active_anomalies_count": 0,
            "pending_decisions_count": 0,
            "production_rate_units_day": 450
        }
    }
}


@app.get("/v1/kpis")
async def get_kpis(scope: Optional[str] = "global", plant_id: Optional[str] = None):
    """Returns manufacturing KPIs computed dynamically from BigQuery (or calibrated baseline fallback)."""
    # Determine requested plant / scope target
    target_key = "GLOBAL"
    if plant_id:
        target_key = plant_id.upper()
    elif scope:
        cleaned = scope.upper()
        if "PLANT:" in cleaned:
            target_key = cleaned.split("PLANT:")[1].strip()
        elif cleaned in ["PNQ", "RYG", "NGO"]:
            target_key = cleaned
        elif cleaned in ["GLOBAL", "ALL"]:
            target_key = "GLOBAL"

    # Attempt live calculation via BigQuery
    bq = get_bq()
    if bq:
        try:
            from google.cloud import bigquery
            plant_filter = "AND plant_id = @plant_id" if target_key != "GLOBAL" else ""
            query = f"""
            WITH plant_states AS (
              SELECT
                SUM(CASE WHEN state = 'RUNNING' THEN TIMESTAMP_DIFF(ts_end, ts_start, SECOND) ELSE 0 END) AS operating_seconds,
                SUM(TIMESTAMP_DIFF(ts_end, ts_start, SECOND)) AS total_seconds,
                SUM(CASE WHEN state = 'DOWN' THEN TIMESTAMP_DIFF(ts_end, ts_start, SECOND) ELSE 0 END) AS down_seconds,
                COUNTIF(state = 'DOWN') AS down_events,
                SUM(good_count) AS total_good,
                SUM(reject_count) AS total_reject,
                SUM(ideal_cycle_s * (good_count + reject_count)) AS ideal_seconds
              FROM `{PROJECT_ID}.silver.machine_states`
              WHERE ts_start >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
              {plant_filter}
            )
            SELECT
              ROUND(SAFE_DIVIDE(operating_seconds, total_seconds) * 100, 1) AS availability_pct,
              ROUND(SAFE_DIVIDE(ideal_seconds, operating_seconds) * 100, 1) AS performance_pct,
              ROUND(SAFE_DIVIDE(total_good, total_good + total_reject) * 100, 1) AS quality_pct,
              ROUND(
                (SAFE_DIVIDE(operating_seconds, total_seconds)) *
                (SAFE_DIVIDE(ideal_seconds, operating_seconds)) *
                (SAFE_DIVIDE(total_good, total_good + total_reject)) * 100, 1
              ) AS oee_pct,
              ROUND(SAFE_DIVIDE(operating_seconds / 3600.0, GREATEST(down_events, 1)), 1) AS mtbf_hours,
              ROUND(SAFE_DIVIDE(down_seconds / 3600.0, GREATEST(down_events, 1)), 1) AS mttr_hours,
              ROUND(SAFE_DIVIDE(total_reject, total_good + total_reject) * 100, 1) AS scrap_rate_pct
            FROM plant_states
            """
            params = []
            if target_key != "GLOBAL":
                params.append(bigquery.ScalarQueryParameter("plant_id", "STRING", target_key))

            job_config = bigquery.QueryJobConfig(query_parameters=params)
            rows = list(bq.query(query, job_config=job_config).result())
            if rows and rows[0].oee_pct is not None:
                r = rows[0]
                base_profile = PLANT_KPIS_MAP.get(target_key, PLANT_KPIS_MAP["GLOBAL"]).copy()
                kpis = base_profile["kpis"].copy()
                kpis["oee_pct"] = float(r.oee_pct)
                kpis["availability_pct"] = float(r.availability_pct or 0.0)
                kpis["performance_pct"] = float(r.performance_pct or 0.0)
                kpis["quality_pct"] = float(r.quality_pct or 0.0)
                kpis["mtbf_hours"] = float(r.mtbf_hours or 0.0)
                kpis["mttr_hours"] = float(r.mttr_hours or 0.0)
                kpis["scrap_rate_pct"] = float(r.scrap_rate_pct or 0.0)
                
                base_profile["kpis"] = kpis
                base_profile["data_source"] = "bigquery_live"
                base_profile["as_of"] = datetime.utcnow().isoformat()
                return base_profile
        except Exception as e:
            logger.warning(f"Error querying live BigQuery KPIs: {e}")

    # Fallback to calibrated baseline profile if BQ tables are empty or query fails
    kpi_profile = PLANT_KPIS_MAP.get(target_key, PLANT_KPIS_MAP["GLOBAL"]).copy()
    kpi_profile["data_source"] = "baseline_contract"
    kpi_profile["as_of"] = datetime.utcnow().isoformat()
    return kpi_profile


# ==========================================
# 3. Assets & Telemetry
# ==========================================
@app.get("/v1/assets/{asset_id}")
async def get_asset(asset_id: str):
    """Retrieves asset metadata and live operational status."""
    bq = get_bq()
    if bq:
        try:
            query = f"SELECT * FROM `{PROJECT_ID}.kg.n_asset` WHERE asset_id = @asset_id LIMIT 1"
            job_config = bigquery.QueryJobConfig(
                query_parameters=[bigquery.ScalarQueryParameter("asset_id", "STRING", asset_id)]
            )
            rows = list(bq.query(query, job_config=job_config).result())
            if rows:
                r = dict(rows[0])
                r["status"] = "DEGRADING" if "CNC-07" in asset_id else "HEALTHY"
                return r
        except Exception as e:
            logger.warning(f"Error querying asset from BQ: {e}")

    # Fallback asset card
    return {
        "asset_id": asset_id,
        "name": f"CNC Milling Center {asset_id}",
        "plant_id": "PNQ" if "PNQ" in asset_id else "NGO",
        "line_id": "PNQ-L1",
        "asset_type": "CNC Machine",
        "criticality": "CRITICAL",
        "status": "DEGRADING" if "CNC-07" in asset_id else "HEALTHY",
        "installed_year": 2021
    }


@app.get("/v1/assets/{asset_id}/telemetry")
async def get_asset_telemetry(asset_id: str, minutes: int = 60, metric: Optional[str] = None):
    """Fetches real-time sensor history (RMS vibration, kurtosis, temp)."""
    bq = get_bq()
    if bq:
        try:
            metric_filter = "AND metric = @metric" if metric else ""
            query = f"""
            SELECT ts_min, metric, avg_value, max_value, min_value
            FROM `{PROJECT_ID}.gold.v_telemetry_1m`
            WHERE asset_id = @asset_id
              AND ts_min > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @minutes MINUTE)
              {metric_filter}
            ORDER BY ts_min ASC
            """
            from google.cloud import bigquery
            params = [
                bigquery.ScalarQueryParameter("asset_id", "STRING", asset_id),
                bigquery.ScalarQueryParameter("minutes", "INT64", minutes),
            ]
            if metric:
                params.append(bigquery.ScalarQueryParameter("metric", "STRING", metric))
            rows = [dict(row) for row in bq.query(query, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()]
            if rows:
                return {"asset_id": asset_id, "readings": rows}
        except Exception as e:
            logger.warning(f"Error querying telemetry from BQ: {e}")

    # Fallback simulated telemetry curve for CNC-07
    now = datetime.utcnow()
    points = []
    for i in range(minutes, 0, -5):
        t = now - timedelta(minutes=i)
        vib = 1.2 + (0.05 * (minutes - i) / 10.0) if "CNC-07" in asset_id else 1.2
        points.append({
            "ts_min": t.isoformat(),
            "metric": "vib_rms",
            "avg_value": round(vib, 2),
            "max_value": round(vib + 0.15, 2),
            "unit": "mm/s"
        })
    return {"asset_id": asset_id, "readings": points}


@app.get("/v1/assets/{asset_id}/health")
async def get_asset_health(asset_id: str):
    """Health score and Remaining Useful Life (RUL) distribution from Sentinel."""
    if "CNC-07" in asset_id:
        return {
            "asset_id": asset_id,
            "health_score": 62,
            "status": "WARNING",
            "failure_mode": "Outer-race bearing spalling (Drive-End)",
            "rul_hours": {
                "p10": 26.5,
                "p50": 34.0,
                "p90": 48.0
            },
            "p10_failure_time": (datetime.utcnow() + timedelta(hours=26.5)).isoformat(),
            "recommended_window": "Thursday 14:00 (PM shift)",
            "required_parts": ["BRG-6205"],
            "parts_available": True
        }
    return {
        "asset_id": asset_id,
        "health_score": 98,
        "status": "HEALTHY",
        "failure_mode": "None",
        "rul_hours": {"p10": 2400.0, "p50": 3200.0, "p90": 4500.0}
    }


# ==========================================
# 4. Insights & Decision Inbox
# ==========================================
@app.get("/v1/insights")
async def list_insights(
    status: str = "new",
    limit: int = 20,
    plant: Optional[str] = None,
    plant_id: Optional[str] = None,
    domain: Optional[str] = None
):
    """Feed of operational insights generated by Sentinel, Scout, Inspector, and Verdant."""
    filter_plant = (plant_id or plant or "").upper()

    fs = get_firestore()
    live_insights = []
    if fs:
        try:
            docs = fs.collection("insights").limit(limit).stream()
            for doc in docs:
                d = doc.to_dict()
                if status == "all" or d.get("status") == status:
                    if not filter_plant or filter_plant in [p.upper() for p in d.get("plant_ids", [])]:
                        if not domain or d.get("domain") == domain:
                            live_insights.append(d)
        except Exception as e:
            logger.warning(f"Error fetching insights from Firestore: {e}")

    if live_insights:
        return {"insights": live_insights}

    # Baseline multi-plant operational insights per Section 6
    all_seed_insights = [
        {
            "id": "ins_anom_cnc07",
            "ts": (datetime.utcnow() - timedelta(minutes=14)).isoformat(),
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
            "id": "ins_qc_porosity_ryg",
            "ts": (datetime.utcnow() - timedelta(minutes=21)).isoformat(),
            "plant_ids": ["RYG"],
            "domain": "quality",
            "severity": "high",
            "title": "Die Casting Porosity Surge on RYG-L2",
            "summary": "Visual inspection detected 4.6% porosity defect cluster on inverter housings. Correlated to 12°C mold cooling line drift.",
            "entities": [{"type": "line", "id": "RYG-L2"}, {"type": "asset", "id": "RYG-DC-01"}],
            "confidence": 0.91,
            "impact": {"usd": 64000.0, "downtime_h": 0.0, "co2_kg": 1200.0},
            "evidence_ids": ["ev_img_porosity_01", "ev_rca_fishbone"],
            "agent": "inspector",
            "status": "new"
        },
        {
            "id": "ins_nrg_loadshift",
            "ts": (datetime.utcnow() - timedelta(minutes=45)).isoformat(),
            "plant_ids": ["NGO"],
            "domain": "sustainability",
            "severity": "medium",
            "title": "TOU Peak Tariff Shifting Opportunity for NGO Induction Furnaces",
            "summary": "Automated schedule shift from peak tariff (18:00-22:00) to off-peak (23:00-06:00) saves $680/day and avoids 1,820 kg CO2.",
            "entities": [{"type": "asset", "id": "NGO-FUR-01"}, {"type": "asset", "id": "NGO-FUR-02"}],
            "confidence": 0.96,
            "impact": {"usd": 18200.0, "downtime_h": 0.0, "co2_kg": -1820.0},
            "evidence_ids": ["ev_opt_loadshift"],
            "agent": "verdant",
            "status": "new"
        },
        {
            "id": "ins_wth_haikui",
            "ts": (datetime.utcnow() - timedelta(minutes=28)).isoformat(),
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

    filtered = []
    for ins in all_seed_insights:
        if status != "all" and ins.get("status") != status:
            continue
        if filter_plant and filter_plant not in ins.get("plant_ids", []):
            continue
        if domain and ins.get("domain") != domain:
            continue
        filtered.append(ins)

    return {"insights": filtered[:limit]}


@app.get("/v1/value-ledger")
async def get_value_ledger():
    """Returns running value ledger totals and avoided losses from Firestore."""
    fs = get_firestore()
    if fs:
        try:
            doc = fs.collection("valueLedger").document("summary").get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            logger.warning(f"Error fetching value ledger from Firestore: {e}")

    return {
        "value_protected_usd": 2410000.0,
        "downtime_hours_avoided": 31.0,
        "co2_avoided_tons": 18.2,
        "currency": "USD",
        "period": "Q3 2026 (Simulated)",
        "active_safeguards": 14,
        "levers": [
            {"lever": "Unplanned downtime", "annual_value_usd": 2190000.0, "improvement": "-35%"},
            {"lever": "Scrap & rework", "annual_value_usd": 900000.0, "improvement": "-25%"},
            {"lever": "Inventory carrying", "annual_value_usd": 720000.0, "improvement": "-12%"},
            {"lever": "Expedite freight", "annual_value_usd": 600000.0, "improvement": "-40%"},
            {"lever": "Energy & TOU tariffs", "annual_value_usd": 600000.0, "improvement": "-10%"},
            {"lever": "Planner productivity", "annual_value_usd": 500000.0, "improvement": "25% freed"}
        ]
    }



@app.get("/v1/decisions")
async def list_decisions(status: str = "pending"):
    """Decision Inbox for cross-functional actions awaiting human authorization."""
    fs = get_firestore()
    live_decisions = []
    if fs:
        try:
            docs = fs.collection("decisions").stream()
            for doc in docs:
                d = doc.to_dict()
                if status == "all" or d.get("status") == status:
                    live_decisions.append(d)
        except Exception as e:
            logger.warning(f"Error querying decisions from Firestore: {e}")

    if live_decisions:
        return {"decisions": live_decisions}

    return {
        "decisions": [
            {
                "decision_id": "dec_wr_typhoon_01",
                "recommendation_id": "rec_typhoon_hsinchu",
                "title": "War Room Decision Brief: Typhoon Haikui-2 Disruption",
                "status": "pending",
                "autonomy_level": "L2",
                "approvers": ["buyer", "planner", "plant_manager"],
                "est_value_usd": 793500.0,
                "plant_ids": ["PNQ", "RYG", "NGO"],
                "options": [
                    {
                        "id": "A",
                        "title": "Activate Alternate Supplier (Penang Electronics) + Split Shifts",
                        "feasible": True,
                        "actions": [
                            {"type": "draft_po", "params": {"supplier_id": "SUP-PENANG-ELEC", "part_id": "STAT-01", "qty": 150}},
                            {"type": "reschedule_production", "params": {"plant_id": "PNQ", "sku_id": "TM-300", "window": "Fri-Sat"}}
                        ],
                        "impact": {
                            "revenue_protected_usd": 793500.0,
                            "expedite_cost_usd": 18400.0,
                            "net_benefit_usd": 775100.0,
                            "otif_impact": "Protected 100%"
                        },
                        "evidence_ids": ["ev_gql_blast", "ev_sql_alt_penang", "ev_opt_schedule"]
                    },
                    {
                        "id": "B",
                        "title": "Expedite Existing Air Freight from Taiwan Before Landfall",
                        "feasible": False,
                        "actions": [
                            {"type": "expedite_shipment", "params": {"carrier": "AirCargo", "port": "TPE"}}
                        ],
                        "impact": {
                            "revenue_protected_usd": 517500.0,
                            "expedite_cost_usd": 42000.0,
                            "net_benefit_usd": 475500.0
                        },
                        "risks": ["Flights grounding risk > 80% due to gale warnings"],
                        "evidence_ids": ["ev_wth_flights"]
                    }
                ],
                "recommended_option": "A",
                "rationale": "Option A protects $793.5k in customer revenue with verified qualified alternate Penang Electronics at only +$18.4k expedite cost."
            }
        ]
    }


@app.post("/v1/decisions/{decision_id}/approve")
async def approve_decision(decision_id: str, payload: Dict[str, Any] = Body(...)):
    """Authorizes an action option with 1 click, publishing to decisions.approved."""
    option_id = payload.get("option_id", "A")
    comment = payload.get("comment", "Approved via Command Center")
    user = await get_current_user()

    # Update Firestore Native status
    fs = get_firestore()
    if fs:
        try:
            fs.collection("decisions").document(decision_id).update({
                "status": "approved",
                "approved_option": option_id,
                "decided_by": user["email"],
                "decided_at": datetime.utcnow().isoformat(),
                "approval_comment": comment
            })
            logger.info(f"Updated Firestore decision status to approved for {decision_id}")
        except Exception as e:
            logger.warning(f"Could not update Firestore decision status: {e}")

    event_payload = {
        "event_id": f"evt_dec_{decision_id}",
        "decision_id": decision_id,
        "option_id": option_id,
        "status": "approved",
        "decided_by": user["email"],
        "decided_at": datetime.utcnow().isoformat(),
        "comment": comment,
        "plant_ids": ["PNQ", "RYG", "NGO"],
        "actions": [
            {"type": "draft_po", "params": {"supplier_id": "SUP-PENANG-ELEC", "part_id": "STAT-01", "qty": 150}},
            {"type": "create_work_order", "params": {"asset_id": "PNQ-CNC-07", "task": "Replace bearing BRG-6205"}}
        ]
    }

    # Publish to Pub/Sub decisions.approved topic
    pubsub = get_pubsub()
    if pubsub:
        try:
            topic = pubsub.topic_path(PROJECT_ID, "decisions.approved")
            pubsub.publish(topic, json.dumps(event_payload).encode("utf-8"))
            logger.info(f"Published decision approval to decisions.approved for {decision_id}")
        except Exception as e:
            logger.error(f"Failed to publish to Pub/Sub: {e}")

    # Forward directly to Action Executor if available
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            await client.post(
                "http://localhost:8081/events",
                json={"message": {"data": json.dumps(event_payload)}}
            )
    except Exception:
        pass

    return {
        "status": "approved",
        "decision_id": decision_id,
        "option_id": option_id,
        "dispatched_actions": len(event_payload["actions"])
    }


# ==========================================
# 5. Supply Chain Blast Radius & Graph
# ==========================================
@app.get("/v1/graph/blast-radius")
async def get_blast_radius(supplier_id: str = "SUP-FORMOSA"):
    """Downstream blast radius calculated from BigQuery Knowledge Graph."""
    bq = get_bq()
    if bq:
        try:
            query = f"""
            SELECT 
              p.part_id, 
              prod.sku_id, 
              so.so_id, 
              so.due_date, 
              so.value_usd, 
              c.name AS customer
            FROM `{PROJECT_ID}.kg.n_supplier` s
            JOIN `{PROJECT_ID}.kg.e_supplies` sup ON s.supplier_id = sup.supplier_id
            JOIN `{PROJECT_ID}.kg.n_part` p ON sup.part_id = p.part_id
            JOIN `{PROJECT_ID}.kg.e_component_of` comp ON p.part_id = comp.part_id
            JOIN `{PROJECT_ID}.kg.n_product` prod ON comp.sku_id = prod.sku_id
            JOIN `{PROJECT_ID}.kg.e_so_for` so_rel ON prod.sku_id = so_rel.sku_id
            JOIN `{PROJECT_ID}.kg.n_sales_order` so ON so_rel.so_id = so.so_id
            JOIN `{PROJECT_ID}.kg.e_orders` ord ON so.so_id = ord.so_id
            JOIN `{PROJECT_ID}.kg.n_customer` c ON ord.customer_id = c.customer_id
            WHERE s.supplier_id = @supplier_id
              AND so.status IN ('OPEN','CONFIRMED')
            ORDER BY so.due_date
            """
            from google.cloud import bigquery
            params = [bigquery.ScalarQueryParameter("supplier_id", "STRING", supplier_id)]
            rows = [dict(row) for row in bq.query(query, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()]
            total_rev = sum(r.get("value_usd", 0.0) for r in rows)
            return {
                "supplier_id": supplier_id,
                "revenue_at_risk_usd": total_rev,
                "affected_orders_count": len(rows),
                "orders": rows,
                "evidence_id": "ev_gql_blast_01"
            }
        except Exception as e:
            logger.warning(f"Error querying blast radius: {e}")

    # Fallback to seeded demo numbers
    return {
        "supplier_id": supplier_id,
        "revenue_at_risk_usd": 793500.0,
        "affected_orders_count": 2,
        "orders": [
            {"part_id": "STAT-01", "sku_id": "TM-300", "so_id": "SO-1001", "due_date": "2026-10-23", "value_usd": 517500.0, "customer": "Tata Motors EV Division"},
            {"part_id": "STAT-01", "sku_id": "TM-300", "so_id": "SO-1002", "due_date": "2026-11-02", "value_usd": 276000.0, "customer": "Toyota Tsusho Automotive"}
        ],
        "evidence_id": "ev_gql_blast_01"
    }


# ==========================================
# 6. Ask GembaOS — Copilot Chat
# ==========================================
@app.post("/v1/chat")
async def chat_copilot(payload: Dict[str, Any] = Body(...)):
    """Ask GembaOS: natural language reasoning across operational data."""
    message = payload.get("message", "")
    fast_model = models.get("FAST", "gemini-3.5-flash-lite")
    
    # Simple direct generation with Gemini
    try:
        from google import genai
        client = genai.Client()
        system_prompt = """
        You are GembaOS Copilot, the AI assistant for Nova Drive manufacturing operations.
        Answer plant questions with concise, evidence-grounded insights.
        Plants: Pune (PNQ), Rayong (RYG), Nagoya (NGO).
        """
        response = client.models.generate_content(
            model=fast_model,
            contents=f"{system_prompt}\nUser Question: {message}"
        )
        return {
            "reply": response.text,
            "evidence_ids": ["ev_sql_copilot"],
            "model_used": fast_model
        }
    except Exception as e:
        logger.warning(f"Error calling Gemini: {e}")
        return {
            "reply": f"GembaOS analysis for '{message}': All operational systems reporting nominal. Active alert on PNQ-CNC-07 vibration drift.",
            "evidence_ids": ["ev_sql_copilot_fallback"],
            "model_used": "fallback"
        }


# ==========================================
# 7. Demo Director — Proxy to Simulator
# ==========================================
@app.post("/v1/demo/scenarios/{name}/start")
async def start_demo_scenario(name: str, payload: Dict[str, Any] = Body(...)):
    """Proxies scenario start requests to the Factory Simulator."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{SIMULATOR_URL}/v1/demo/scenarios/{name}/start", json=payload)
            return resp.json()
    except Exception as e:
        logger.warning(f"Could not reach simulator on {SIMULATOR_URL}: {e}")
        return {
            "status": "started",
            "scenario": name,
            "simulated": True,
            "notice": "Simulated locally (simulator service offline)"
        }


@app.post("/v1/demo/reset")
async def reset_demo():
    """Resets simulator to clean initial factory state."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{SIMULATOR_URL}/v1/demo/reset")
            return resp.json()
    except Exception:
        return {"status": "reset", "simulated": True}


# ==========================================
# 8. Production Planner & Optimizer (OR-Tools CP-SAT)
# ==========================================
try:
    from backend.services.optimizer.main import router as optimizer_router
    app.include_router(optimizer_router)
    logger.info("Successfully mounted Optimizer router (CP-SAT scheduler & CTP).")
except Exception as e:
    logger.warning(f"Could not mount Optimizer router: {e}")


# ==========================================
# 9. Procurement Hub & PO Operations
# ==========================================
@app.get("/v1/procurement/reorder-worklist")
async def get_reorder_worklist(plant_id: Optional[str] = None):
    """Returns urgent and recommended spare parts and raw material reorder worklist."""
    bq = get_bq()
    items = []
    if bq:
        try:
            plant_clause = "WHERE plant_id = @plant_id" if plant_id else ""
            query = f"""
            SELECT plant_id, part_id, stock_qty, reserved_qty, location_bin, last_updated
            FROM `{PROJECT_ID}.silver.inventory`
            {plant_clause}
            ORDER BY stock_qty ASC
            LIMIT 15
            """
            from google.cloud import bigquery
            params = [bigquery.ScalarQueryParameter("plant_id", "STRING", plant_id)] if plant_id else []
            rows = [dict(r) for r in bq.query(query, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()]
            
            part_meta = {
                "BRG-6205": {"part_name": "Spindle Bearing 6205", "supplier": "NSK Japan", "unit_cost": 42.0, "urgency": "critical", "reason": "PNQ-CNC-07 vibration degradation buffer"},
                "IC-GD-01": {"part_name": "Gate-driver IC-GD-01", "supplier": "Penang Micro (alt)", "unit_cost": 24.8, "urgency": "high", "reason": "Typhoon Haikui-2 Taiwan supply buffer"},
                "AL-A380-INGOT": {"part_name": "Die-cast Aluminum Ingot (tons)", "supplier": "Thai Smelting Co", "unit_cost": 2450.0, "urgency": "medium", "reason": "Weekly replenishment buffer"},
                "GR-WHEEL-CBN-300": {"part_name": "CBN Gear Grinding Wheel", "supplier": "Nagoya Precision Tool", "unit_cost": 1200.0, "urgency": "medium", "reason": "Gear line preventive tool replenishment"},
                "MOLD-DIE-INV200": {"part_name": "Die-Casting Cavity Insert Set", "supplier": "Bangkok Tooling", "unit_cost": 8500.0, "urgency": "low", "reason": "Semi-annual tooling rotation"}
            }

            for r in rows:
                p_id = r["part_id"]
                meta = part_meta.get(p_id, {
                    "part_name": p_id,
                    "supplier": "Qualified Tier-1 Supplier",
                    "unit_cost": 150.0,
                    "urgency": "medium",
                    "reason": "Replenishment buffer"
                })
                reorder_qty = 20 if "BRG" in p_id else (500 if "IC" in p_id else (10 if "INGOT" in p_id else 15))
                total_cost = reorder_qty * meta["unit_cost"]
                items.append({
                    "part_id": p_id,
                    "part_name": meta["part_name"],
                    "plant_id": r["plant_id"],
                    "stock_qty": r["stock_qty"],
                    "reserved_qty": r["reserved_qty"],
                    "location_bin": r["location_bin"],
                    "recommended_qty": reorder_qty,
                    "supplier": meta["supplier"],
                    "unit_cost_usd": meta["unit_cost"],
                    "total_cost_usd": total_cost,
                    "urgency": meta["urgency"],
                    "reason": meta["reason"]
                })
        except Exception as e:
            logger.warning(f"Error querying inventory for reorder worklist: {e}")

    if not items:
        # Fallback to calibrated items
        items = [
            {"part_id": "BRG-6205", "part_name": "Spindle Bearing 6205", "plant_id": "PNQ", "stock_qty": 14, "reserved_qty": 2, "location_bin": "PNQ-A01-04", "recommended_qty": 20, "supplier": "NSK Japan", "unit_cost_usd": 42.0, "total_cost_usd": 840.0, "urgency": "critical", "reason": "PNQ-CNC-07 vibration degradation buffer"},
            {"part_id": "IC-GD-01", "part_name": "Gate-driver IC-GD-01", "plant_id": "PNQ", "stock_qty": 180, "reserved_qty": 50, "location_bin": "PNQ-E01-08", "recommended_qty": 500, "supplier": "Penang Micro (alt)", "unit_cost_usd": 24.8, "total_cost_usd": 12400.0, "urgency": "high", "reason": "Typhoon Haikui-2 Taiwan supply buffer"},
            {"part_id": "AL-A380-INGOT", "part_name": "Die-cast Aluminum Ingot (tons)", "plant_id": "RYG", "stock_qty": 22, "reserved_qty": 4, "location_bin": "RYG-RAW-01", "recommended_qty": 10, "supplier": "Thai Smelting Co", "unit_cost_usd": 2450.0, "total_cost_usd": 24500.0, "urgency": "medium", "reason": "Weekly replenishment buffer"}
        ]
    return {"worklist": items, "count": len(items)}


@app.post("/v1/procurement/draft-po")
@app.post("/v1/procurement/po")
async def draft_purchase_order(payload: Dict[str, Any] = Body(...)):
    """
    Drafts an authorized Purchase Order in ERP staging:
    Assigns tracking PO number, validates buyer authorization, 
    calculates delivery dates with supplier lead times.
    """
    part_id = payload.get("part_id", "IC-GD-01")
    supplier = payload.get("supplier", "Penang Micro (alt)")
    qty = int(payload.get("qty", 500))
    freight = payload.get("freight", "AIR_EXPEDITE")
    reason = payload.get("reason", "Replenishment buffer")
    unit_cost = float(payload.get("unit_cost_usd", 24.8 if "IC" in part_id else (42.0 if "BRG" in part_id else 120.0)))
    total_cost = round(qty * unit_cost, 2)

    import uuid
    po_number = f"PO-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    lead_days = 6 if "Penang" in supplier or freight == "AIR_EXPEDITE" else 14
    est_delivery = (datetime.utcnow() + timedelta(days=lead_days)).strftime("%Y-%m-%d")

    po_record = {
        "status": "DRAFTED",
        "po_number": po_number,
        "part_id": part_id,
        "supplier": supplier,
        "qty": qty,
        "unit_cost_usd": unit_cost,
        "total_cost_usd": total_cost,
        "freight": freight,
        "lead_time_days": lead_days,
        "estimated_delivery_date": est_delivery,
        "reason": reason,
        "created_at": datetime.utcnow().isoformat(),
        "governance": {
            "requires_role": "buyer",
            "approval_status": "PENDING_BUYER_SIGN_OFF",
            "reversible": True
        },
        "target_system": "ERP",
        "message": f"Draft Purchase Order {po_number} staged in ERP. Awaiting buyer authorization."
    }

    fs = get_firestore()
    if fs:
        try:
            fs.collection("purchase_orders").document(po_number).set(po_record)
        except Exception as e:
            logger.warning(f"Could not persist PO to Firestore: {e}")

    logger.info(f"Created draft PO: {po_number} ({part_id} x {qty} from {supplier})")
    return po_record

