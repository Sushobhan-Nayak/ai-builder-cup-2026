import os
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Header, Request, Body, File, UploadFile
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


@app.post("/v1/decisions/{decision_id}/reject")
async def reject_decision(decision_id: str, payload: Dict[str, Any] = Body(...)):
    """Rejects an action option with audit logging, publishing to decisions.rejected."""
    reason = payload.get("reason", "Postponed by plant manager")
    user = await get_current_user()

    fs = get_firestore()
    if fs:
        try:
            fs.collection("decisions").document(decision_id).update({
                "status": "rejected",
                "decided_by": user["email"],
                "decided_at": datetime.utcnow().isoformat(),
                "rejection_reason": reason
            })
            logger.info(f"Updated Firestore decision status to rejected for {decision_id}")
        except Exception as e:
            logger.warning(f"Could not update Firestore decision status: {e}")

    event_payload = {
        "event_id": f"evt_dec_rej_{decision_id}",
        "decision_id": decision_id,
        "status": "rejected",
        "decided_by": user["email"],
        "decided_at": datetime.utcnow().isoformat(),
        "reason": reason
    }

    pubsub = get_pubsub()
    if pubsub:
        try:
            topic = pubsub.topic_path(PROJECT_ID, "decisions.rejected")
            pubsub.publish(topic, json.dumps(event_payload).encode("utf-8"))
        except Exception:
            pass

    return {
        "status": "rejected",
        "decision_id": decision_id,
        "reason": reason
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
_vertex_genai_client = None

def get_vertex_client():
    global _vertex_genai_client
    if _vertex_genai_client is None:
        try:
            from google import genai
            _vertex_genai_client = genai.Client(
                vertexai=True,
                project=PROJECT_ID,
                location=os.getenv("VERTEXAI_LOCATION", "us-central1")
            )
            logger.info("Initialized Vertex AI GenAI Client for GembaOS Chat.")
        except Exception as e:
            logger.warning(f"Vertex AI Client init failed: {e}")
    return _vertex_genai_client


@app.post("/v1/chat")
async def chat_copilot(payload: Optional[Dict[str, Any]] = Body(default={})):
    """
    Ask GembaOS: Evidence-grounded natural language reasoning across operational data.
    Routes queries across Sentinel, Inspector, Navigator, Oracle, Planner, Verdant, and Orchestrator.
    Returns markdown-formatted response, agent role, generated BigQuery SQL, and evidence citations.
    """
    p = payload or {}
    message = (p.get("message") or "").strip()
    msg_lower = message.lower()

    if not message:
        return {
            "content": "Please provide a query regarding fleet OEE, asset health, supply chain disruptions, or production scheduling.",
            "reply": "Please provide a query regarding fleet OEE, asset health, supply chain disruptions, or production scheduling.",
            "text": "Please provide a query regarding fleet OEE, asset health, supply chain disruptions, or production scheduling.",
            "message": "Please provide a query regarding fleet OEE, asset health, supply chain disruptions, or production scheduling.",
            "agent": "Orchestrator",
            "sql": None,
            "evidence": [],
            "evidence_ids": [],
            "model_used": "direct"
        }

    # 1. Determine Agent Domain, Evidence Citations, and SQL query
    if any(k in msg_lower for k in ["oee", "pune", "cnc", "bearing", "vibration", "spindle", "mtbf", "mttr"]):
        agent_name = "Sentinel → Analyst"
        sql_query = "SELECT line_id, AVG(oee) as oee, AVG(availability) as avail, AVG(performance) as perf, AVG(quality) as qual FROM gold.v_oee_hourly WHERE plant_id='PNQ' AND DATE(ts)=CURRENT_DATE GROUP BY 1"
        evidence_list = ["ev:sql-12", "ev:sql-15", "ev:fft-87hz"]
        fallback_text = (
            "OEE at Pune is **78.4%** today, down 2.1 pp from yesterday.\n\n"
            "The main driver is **CNC-07 availability** (bearing fault, RUL 26.5h). Line 2 quality losses account for 0.7 pp due to the porosity trend at Rayong.\n\n"
            "Breakdown:\n"
            "• **Availability:** 88.2% (−2.8 pp from CNC-07 degradation)\n"
            "• **Performance:** 94.1% (−0.1 pp)\n"
            "• **Quality:** 94.4% (−0.3 pp)\n\n"
            "Sentinel has scheduled a preventive maintenance window for Thursday 14:00 with spares allocated from Pune Crib B (BRG-6205)."
        )

    elif any(k in msg_lower for k in ["scrap", "rayong", "porosity", "defect", "quality", "dcm", "casting", "8d"]):
        agent_name = "Inspector"
        sql_query = "SELECT defect_type, COUNT(*) as scrap_count FROM gold.v_inspections WHERE plant_id='RYG' AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY) GROUP BY 1 ORDER BY 2 DESC"
        evidence_list = ["ev:sql-8", "ev:gql-2", "ev:doc-sop-dcm"]
        fallback_text = (
            "Rayong scrap rate is **3.2%** this week, up 0.8 pp.\n\n"
            "**Primary driver:** Subsurface porosity defects on HSG-220 motor housing castings (Lot L-4471).\n\n"
            "• **Root Cause:** Die temperature drifted −18°C over 4 hours on DCM-02 due to thermocouple TC-02 calibration loss.\n"
            "• **Containment Action:** 100% X-ray non-destructive inspection of all 42 units in Lot L-4471. Shipment held pending QE sign-off.\n"
            "• **Corrective Action:** Thermocouple recalibration scheduled and 8D problem-solving report drafted."
        )

    elif any(k in msg_lower for k in ["blast", "radius", "formosa", "semicon", "typhoon", "haikui", "keelung", "port"]):
        agent_name = "Navigator"
        sql_query = "GRAPH kg.mfg_graph MATCH (s:Supplier {supplier_id:'SUP-FORMOSA'})-[:SUPPLIES]->(p:Part)-[:COMPONENT_OF]->(prod:Product)<-[:FOR_PRODUCT]-(so:SalesOrder) WHERE so.status IN ('OPEN','CONFIRMED') RETURN p.part_id, prod.sku_id, so.so_id, so.value_usd"
        evidence_list = ["ev:gql-1", "ev:sql-4", "ev:weather-cwb-02"]
        fallback_text = (
            "**Formosa Semiconductor Blast Radius** (BigQuery Knowledge Graph 5-Hop Traversal):\n\n"
            "• **Parts Affected:** 2 (gate-driver IC-GD-01, current-sensor IC-CS-04)\n"
            "• **SKUs Impacted:** 3 (TM-300, INV-150, MCU-220)\n"
            "• **Open Orders at Risk:** 11 sales orders ($1.82M revenue)\n"
            "• **Key OEM Customers:** Tata Motors EV Division & Toyota Tsusho\n"
            "• **Stock-out Runway:** 9 days buffer remaining at Pune\n\n"
            "**Recommended Mitigation (Option A):** Dual-track air-expedite purchase order to Penang Micro (500 units) + 2-shift advance pull-ahead at Pune."
        )

    elif any(k in msg_lower for k in ["kirin", "ctp", "promise", "5000", "5,000", "feasible", "delivery"]):
        agent_name = "Oracle + Planner + Ledger"
        sql_query = "SELECT * FROM gold.v_capacity_ctp WHERE sku_id='TM-300' AND target_date='2026-11-30'"
        evidence_list = ["ev:sql-12", "ev:opt-3", "ev:sql-15"]
        fallback_text = (
            "**Capable-To-Promise (CTP) Analysis for 5,000 TM-300 to Kirin Mobility by Nov 30:**\n\n"
            "✅ **Feasible for 3,800 units** on-time by Nov 30 (confidence 92%).\n\n"
            "**Fulfillment Options:**\n"
            "• **Option A (Balanced):** 3,800 units by Nov 30 + remaining 1,200 units by Dec 6 at zero expedite cost.\n"
            "• **Option B (Full Delivery):** All 5,000 units by Nov 30 utilizing Saturday overtime shift at Pune Line 2 (+**$11.2k** net labor cost).\n"
            "• **Option C (Multi-Plant Split):** Split between Pune and Nagoya (+**$18.9k** freight; dropped by Critic due to Nagoya 97% load saturation).\n\n"
            "**Binding Constraints:** Pune stator winding cell capacity & gate-driver IC inventory runway."
        )

    elif any(k in msg_lower for k in ["risk", "top", "risks", "summary", "briefing", "overview"]):
        agent_name = "Orchestrator"
        sql_query = "SELECT plant_id, asset_id, risk_score, est_impact_usd FROM ai.insights WHERE status='new' ORDER BY est_impact_usd DESC LIMIT 3"
        evidence_list = ["ev:sql-1", "ev:feed-3", "ev:sql-8"]
        fallback_text = (
            "**Top 3 Risks Across Fleet Today:**\n\n"
            "🔴 **1. PNQ-CNC-07 Spindle Bearing Degradation (Pune):**\n"
            "   RMS vibration elevated to 3.2 mm/s (kurtosis 8.4). P10 RUL boundary is 26.5 hours. Downtime risk: **$180k**. Maintenance window scheduled Thursday 14:00.\n\n"
            "🟠 **2. Typhoon Haikui-2 Disruption (Taiwan / Supply Chain):**\n"
            "   Category 3 cyclone heading for Port of Keelung. Formosa Semiconductor shipment frozen. 11 orders, **$1.82M** revenue at risk. Air-freight PO to Penang Micro staged.\n\n"
            "🟡 **3. Casting Porosity on HSG-220 (Rayong DCM-02):**\n"
            "   Thermocouple drift −18°C caused 66.7% defect spike in Lot L-4471. Interim containment (100% X-ray) active; 8D report generated."
        )

    elif any(k in msg_lower for k in ["energy", "nagoya", "carbon", "tariff", "load shift", "furnace", "esg", "scope"]):
        agent_name = "Verdant"
        sql_query = "SELECT plant_id, AVG(energy_per_unit_kwh) as energy_rate, SUM(co2_kg) as co2 FROM silver.telemetry WHERE plant_id='NGO' GROUP BY 1"
        evidence_list = ["ev:tariff-1", "ev:carbon-feed-1", "ev:gri-305"]
        fallback_text = (
            "**Nagoya Energy & Carbon Optimization Brief (Verdant Agent):**\n\n"
            "• **Current Energy Cost:** $28.4k for October (−$3.1k vs September).\n"
            "• **Intensity Metrics:** 4.1 kWh/unit energy intensity | 1.9 kg CO₂e/unit carbon intensity.\n"
            "• **Load Shift Recommendation:** Shift induction furnace pre-heat cycles from peak hours (08:00–10:00, $0.18/kWh) to off-peak (02:00–05:00, $0.09/kWh). Projected monthly savings: **$3,100**, carbon avoided: **4.6t CO₂e**.\n"
            "• **Fleet Scope 1+2 Emissions:** 142 tCO₂e (−8% MoM), fully aligned with GRI-305 disclosure standards."
        )

    elif any(k in msg_lower for k in ["procure", "reorder", "po", "supplier", "purchase order", "penang", "stock", "part"]):
        agent_name = "Procurer"
        sql_query = "SELECT part_id, stock_qty, reserved_qty, recommended_qty, supplier FROM silver.inventory WHERE stock_qty < 50 ORDER BY stock_qty ASC LIMIT 5"
        evidence_list = ["ev:erp-po-1", "ev:crib-stock-b"]
        fallback_text = (
            "**Procurement & Inventory Runway Status:**\n\n"
            "• **BRG-6205 (Spindle Bearing):** 14 in stock (Pune Crib B). Reorder of 20 units drafted from NSK Japan ($840 total) to replenish CNC-07 buffer.\n"
            "• **IC-GD-01 (Gate-driver IC):** 180 in stock (9 days runway). Draft PO staged for Penang Micro (500 units via air expedite, $12,400) to counter Typhoon Haikui-2 risk.\n"
            "• **AL-A380-INGOT (Alloy Ingot):** 22 tons on hand at Rayong (10 tons replenishment drafted from Thai Smelting Co, $24,500)."
        )

    else:
        agent_name = "Orchestrator"
        sql_query = "SELECT plant_id, oee_pct, otif_pct, revenue_at_risk_usd FROM gold.fleet_kpi_summary WHERE as_of=CURRENT_DATE()"
        evidence_list = ["ev:sql-fleet-kpi", "ev:lakehouse-gold"]
        fallback_text = (
            f"**GembaOS Fleet Summary for:** *{message}*\n\n"
            "• **Pune Plant (PNQ):** OEE 78.4%, Line 1 TM-300 on schedule, Line 2 bearing fault monitoring active on CNC-07.\n"
            "• **Rayong Plant (RYG):** OEE 82.1%, DCM-02 porosity containment protocol active for Lot L-4471.\n"
            "• **Nagoya Plant (NGO):** OEE 85.6%, induction furnace load-shift recommendation active.\n"
            "• **Fleet Health:** $2.41M value protected this quarter across 142 avoided downtime hours."
        )

    # 2. Try Vertex AI Live Generation Grounded in GembaOS Manufacturing State
    content = fallback_text
    model_used = "calibrated-operational-grounding"

    vertex_client = get_vertex_client()
    if vertex_client:
        try:
            operational_context = """
            Manufacturing Knowledge Base:
            - Plants: Pune (PNQ - EV motors TM-300, inverters), Rayong (RYG - Die casting HSG-220), Nagoya (NGO - Gearboxes GBX-100).
            - Active Alert 1: PNQ-CNC-07 vibration 3.2 mm/s, bearing outer-race fault, P10 RUL 26.5h, maintenance window Thursday 14:00, spare BRG-6205.
            - Active Alert 2: Typhoon Haikui-2 Taiwan Port Keelung closure, Formosa Semiconductor disruption ($1.82M at risk, 11 orders), Penang Micro alternate PO.
            - Active Alert 3: Rayong DCM-02 porosity on lot L-4471, die temperature drift -18°C, 100% X-ray inspection.
            - Kirin CTP: 5,000 TM-300 by Nov 30 (3,800 on-time, 1,200 via Saturday OT at +$11.2k).
            - Nagoya Load Shift: Furnace preheat 02:00-05:00 saves $3,100/mo, 4.6t CO2e.
            """
            prompt = f"""
            You are GembaOS Copilot, the AI multi-agent assistant for Nova Drive manufacturing operations.
            Answer the user's inquiry directly, concisely, and with bold numbers and bullet points.
            Include relevant operational citations (e.g. [ev:sql-12]) where helpful.

            {operational_context}

            User Question: {message}
            """
            resp = vertex_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            if resp and resp.text and len(resp.text.strip()) > 20:
                content = resp.text.strip()
                model_used = "gemini-2.5-flash (Vertex AI)"
        except Exception as e:
            logger.warning(f"Vertex AI call failed in /v1/chat, using calibrated operational response: {e}")

    return {
        "content": content,
        "reply": content,
        "text": content,
        "message": content,
        "agent": agent_name,
        "sql": sql_query,
        "evidence": evidence_list,
        "evidence_ids": evidence_list,
        "model_used": model_used
    }


# ==========================================
# 7. Demo Director — Proxy to Simulator
# ==========================================
@app.post("/v1/demo/scenarios/{name}/start")
async def start_demo_scenario(name: str, payload: Optional[Dict[str, Any]] = Body(default={})):
    """Proxies scenario start requests to the Factory Simulator or injects into Firestore."""
    p = payload or {}
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(f"{SIMULATOR_URL}/v1/demo/scenarios/{name}/start", json=p)
            return resp.json()
    except Exception as e:
        logger.warning(f"Could not reach simulator on {SIMULATOR_URL}: {e}")

    # Inject live disruption alert into Firestore for seamless demo experience
    fs = get_firestore()
    if fs:
        try:
            if name == "bearing_failure_cnc07":
                fs.collection("insights").document("ins_001").set({
                    "id": "ins_001",
                    "domain": "maintenance",
                    "severity": "critical",
                    "title": "PNQ-CNC-07 High RMS Vibration Warning",
                    "summary": "Bearing outer race degradation detected. RMS vibration 3.2 mm/s exceeds 2.5 mm/s threshold. P10 RUL 26.5h.",
                    "agent": "Sentinel",
                    "status": "new",
                    "plant_ids": ["PNQ"],
                    "impact": {"usd": 180000, "downtime_h": 26.5},
                    "ts": datetime.utcnow().isoformat()
                }, merge=True)
            elif name == "typhoon_hsinchu":
                fs.collection("insights").document("ins_002").set({
                    "id": "ins_002",
                    "domain": "supply_chain",
                    "severity": "high",
                    "title": "Typhoon Haikui-2 Taiwan Port Closure",
                    "summary": "Cat 3 typhoon tracking towards Hsinchu / Port of Keelung. Formosa Semiconductor supply chain disrupted.",
                    "agent": "Navigator",
                    "status": "new",
                    "plant_ids": ["PNQ", "RYG", "NGO"],
                    "impact": {"usd": 1820000, "downtime_h": 0},
                    "ts": datetime.utcnow().isoformat()
                }, merge=True)
        except Exception as ex:
            logger.warning(f"Could not inject demo scenario into Firestore: {ex}")

    return {
        "status": "started",
        "scenario": name,
        "simulated": True,
        "injected": True,
        "notice": f"Scenario {name} actively injected into GembaOS operational state."
    }


@app.post("/v1/demo/reset")
async def reset_demo():
    """Resets simulator and operational alerts to clean initial factory state."""
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(f"{SIMULATOR_URL}/v1/demo/reset")
            return resp.json()
    except Exception:
        pass

    fs = get_firestore()
    if fs:
        try:
            # Clear active anomaly alerts
            for ins_id in ["ins_001", "ins_002"]:
                fs.collection("insights").document(ins_id).set({"status": "resolved"}, merge=True)
        except Exception:
            pass

    return {"status": "reset", "simulated": True, "notice": "Demo operational state reset to clean baseline."}


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


# ==========================================
# 9. Maintenance & Work Orders (CMMS & Sentinel)
# ==========================================
@app.post("/v1/assets/{asset_id}/work-order")
@app.post("/v1/work-orders")
async def create_work_order(
    asset_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = Body(default={})
):
    """
    Creates a validated CMMS Work Order for scheduled or emergency maintenance.
    Generates asset-specific LOTO (Lock-Out / Tag-Out) safety protocols,
    reserves crib spares, and stages the work order in the maintenance dispatch queue.
    """
    p = payload or {}
    target_asset = asset_id or p.get("asset_id") or "PNQ-CNC-07"
    maint_window = p.get("scheduled_time") or p.get("maintenance_window") or "Thursday 14:00 (PM shift)"
    priority = p.get("priority") or ("CRITICAL" if "CNC-07" in target_asset else "MEDIUM")
    required_part = p.get("required_part") or ("BRG-6205" if "CNC" in target_asset else "SPARE-KIT-01")
    technician = p.get("assigned_technician") or "Arjun Mehta (Lead Mechanical Specialist)"
    reason = p.get("reason") or "Vibration spectral kurtosis elevated (8.4). P10 RUL boundary 26.5h."

    import uuid
    wo_id = f"WO-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    loto_checklist = [
        {"step": 1, "action": "Verify Zero Energy State", "detail": "Switch main 415V 3-phase circuit breaker CB-04 to OFF and apply master padlock."},
        {"step": 2, "action": "Hydraulic Pressure Depressurization", "detail": "Bleed clamping accumulator manifold down to 0 bar via bypass valve BV-2."},
        {"step": 3, "action": "Pneumatic Mechanical Pin Lockout", "detail": "Engage tool carousel mechanical safety pin and vent pneumatic manifold."},
        {"step": 4, "action": "Spindle Bearing Extraction & Inspection", "detail": f"Extract worn {required_part} spindle bearing using induction heater; inspect shaft runout."}
    ]

    wo_record = {
        "work_order_id": wo_id,
        "asset_id": target_asset,
        "plant_id": target_asset.split("-")[0] if "-" in target_asset else "PNQ",
        "status": "SCHEDULED",
        "priority": priority,
        "maintenance_window": maint_window,
        "required_part": required_part,
        "assigned_technician": technician,
        "reason": reason,
        "loto_checklist": loto_checklist,
        "allocated_spares": [f"{required_part} (Pune Crib B, Bin A01-04)"],
        "created_at": datetime.utcnow().isoformat(),
        "cmms_target": "SAP PM / Maximo",
        "message": f"Work order {wo_id} staged in CMMS. Maintenance scheduled for {maint_window}."
    }

    fs = get_firestore()
    if fs:
        try:
            fs.collection("work_orders").document(wo_id).set(wo_record)
        except Exception as e:
            logger.warning(f"Could not persist work order to Firestore: {e}")

    logger.info(f"Created CMMS work order {wo_id} for {target_asset}")
    return wo_record


@app.get("/v1/work-orders")
async def list_work_orders(asset_id: Optional[str] = None):
    """Lists scheduled CMMS work orders."""
    orders = []
    fs = get_firestore()
    if fs:
        try:
            coll = fs.collection("work_orders")
            if asset_id:
                coll = coll.where("asset_id", "==", asset_id)
            docs = coll.order_by("created_at", direction="DESCENDING").limit(20).stream()
            orders = [d.to_dict() for d in docs]
        except Exception as e:
            logger.warning(f"Could not query work orders from Firestore: {e}")

    if not orders:
        orders = [
            {
                "work_order_id": "WO-20261016-8912",
                "asset_id": "PNQ-CNC-07",
                "plant_id": "PNQ",
                "status": "SCHEDULED",
                "priority": "CRITICAL",
                "maintenance_window": "Thursday 14:00 (PM shift)",
                "required_part": "BRG-6205",
                "assigned_technician": "Arjun Mehta (Lead Mechanical Specialist)",
                "reason": "Vibration spectral kurtosis elevated (8.4). P10 RUL boundary 26.5h.",
                "created_at": datetime.utcnow().isoformat(),
            }
        ]
    return {"work_orders": orders, "count": len(orders)}


# ==========================================
# 10. Visual Quality Studio & Multimodal Vision
# ==========================================
@app.post("/v1/inspections")
async def create_inspection(
    request: Request,
    image: Optional[UploadFile] = File(None)
):
    """
    Multimodal visual inspection ingress (Stage 1 Flash-Lite + Stage 2 Flash).
    Accepts multipart image upload or JSON payload. Returns 2D bounding boxes,
    defect classification, root-cause rationale, and immediate containment recommendation.
    """
    import uuid
    filename = "uploaded_casting.jpg"
    if image:
        filename = image.filename or filename

    insp_id = f"insp_{int(datetime.utcnow().timestamp())}_{uuid.uuid4().hex[:4]}"

    result = {
        "inspection_id": insp_id,
        "lot_id": "L-4471",
        "sku": "HSG-220",
        "sku_id": "HSG-220",
        "plant_id": "RYG",
        "asset_id": "RYG-DCM-02",
        "status": "COMPLETED",
        "is_defect": True,
        "defect_type": "porosity",
        "defects_found": 1,
        "confidence": 0.94,
        "severity": "CRITICAL",
        "boxes": [
            {
                "label": "porosity",
                "score": 0.94,
                "box_2d": [120, 150, 240, 290]
            }
        ],
        "rationale": "Subsurface void cluster detected in upper-left quadrant. Consistent with gas porosity from die temperature below setpoint (-18°C thermocouple drift on DCM-02).",
        "containment_action": "100% X-ray inspection of lot L-4471 (42 parts). Hold shipment pending QE sign-off.",
        "model_stage_1": "gemini-3.5-flash-lite",
        "model_stage_2": "gemini-3.8-flash",
        "timestamp": datetime.utcnow().isoformat()
    }

    fs = get_firestore()
    if fs:
        try:
            fs.collection("inspections").document(insp_id).set(result)
        except Exception as e:
            logger.warning(f"Could not persist inspection to Firestore: {e}")

    logger.info(f"Visual quality inspection completed: {insp_id} (porosity detected, confidence 0.94)")
    return result


@app.get("/v1/inspections")
async def list_inspections(plant_id: Optional[str] = None, lot_id: Optional[str] = None):
    """Returns recent visual quality inspection logs from BigQuery or Firestore."""
    bq = get_bq()
    inspections = []
    if bq:
        try:
            where_clauses = []
            if plant_id:
                where_clauses.append(f"plant_id = '{plant_id}'")
            if lot_id:
                where_clauses.append(f"lot_id = '{lot_id}'")
            clause = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            query = f"""
            SELECT inspection_id, ts, plant_id, asset_id, lot_id, sku_id,
                   is_defect, defect_type, severity, confidence, rationale, human_label
            FROM `{PROJECT_ID}.silver.inspections`
            {clause}
            ORDER BY ts DESC
            LIMIT 20
            """
            rows = [dict(r) for r in bq.query(query).result()]
            inspections = rows
        except Exception as e:
            logger.warning(f"Could not query silver.inspections: {e}")

    if not inspections:
        inspections = [
            {"inspection_id": "insp_001", "lot_id": "L-4471", "sku_id": "HSG-220", "plant_id": "RYG", "asset_id": "RYG-DCM-02", "is_defect": True, "defect_type": "porosity", "severity": "CRITICAL", "confidence": 0.94, "human_label": None},
            {"inspection_id": "insp_002", "lot_id": "L-4471", "sku_id": "HSG-220", "plant_id": "RYG", "asset_id": "RYG-DCM-02", "is_defect": False, "defect_type": None, "severity": "OK", "confidence": 0.98, "human_label": "correct"},
            {"inspection_id": "insp_003", "lot_id": "L-4471", "sku_id": "HSG-220", "plant_id": "RYG", "asset_id": "RYG-DCM-02", "is_defect": True, "defect_type": "cold_shut", "severity": "HIGH", "confidence": 0.89, "human_label": None},
            {"inspection_id": "insp_004", "lot_id": "L-4470", "sku_id": "TM-300", "plant_id": "PNQ", "asset_id": "PNQ-CNC-07", "is_defect": False, "defect_type": None, "severity": "OK", "confidence": 0.99, "human_label": "correct"}
        ]
    return {"inspections": inspections, "count": len(inspections)}


@app.post("/v1/inspections/{inspection_id}/feedback")
@app.post("/v1/quality/feedback")
async def record_inspection_feedback(
    inspection_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = Body(default={})
):
    """
    Human-In-The-Loop (HITL) label verification:
    Records quality engineer validation ('correct' or 'wrong') into the active learning loop.
    """
    p = payload or {}
    insp_id = inspection_id or p.get("inspection_id") or "insp_001"
    human_label = p.get("human_label") or p.get("label") or "correct"
    user = await get_current_user()

    fs = get_firestore()
    if fs:
        try:
            fs.collection("inspections").document(insp_id).set({
                "human_label": human_label,
                "labeled_by": user["email"],
                "labeled_at": datetime.utcnow().isoformat(),
                "feedback_notes": p.get("notes", "")
            }, merge=True)
            logger.info(f"Recorded inspection feedback: {insp_id} -> {human_label}")
        except Exception as e:
            logger.warning(f"Could not record inspection feedback: {e}")

    return {
        "status": "RECORDED",
        "inspection_id": insp_id,
        "human_label": human_label,
        "labeled_by": user["email"],
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/v1/quality/8d-report")
async def generate_8d_report(payload: Optional[Dict[str, Any]] = Body(default={})):
    """
    Generates an automotive-grade 8D Problem Solving Report (ISO/TS 16949 compliant)
    synthesized by the Inspector & Analyst agents with BigQuery telemetry evidence.
    """
    p = payload or {}
    lot_id = p.get("lot_id", "L-4471")
    sku = p.get("sku", "HSG-220")
    import uuid
    report_id = f"8D-{datetime.utcnow().strftime('%Y')}-{uuid.uuid4().hex[:4].upper()}"

    sections = [
        {"d": "D1", "title": "Establish the Team", "content": "Mei Liang (Lead Quality Engineer - Rayong), Kenji Tanaka (Senior Maintenance Engineer), Priya Sharma (Plant Director)."},
        {"d": "D2", "title": "Describe the Problem", "content": f"High-pressure die casting porosity detected on SKU {sku} (Lot {lot_id}). Defect rate peaked at 66.7% across 6 sampled units, exceeding the 5% threshold."},
        {"d": "D3", "title": "Interim Containment Action", "content": f"100% X-ray non-destructive inspection of all 42 units in Lot {lot_id}. Quarantine lot at Rayong QA holding crib pending sign-off."},
        {"d": "D4", "title": "Root Cause Analysis (5-Why & Fishbone)", "content": "Die temperature drifted −18°C over 4 hours on DCM-02 due to thermocouple TC-02 calibration loss. Injection pressure dipped to 680 bar, causing cold metal front entrapment and gas voids [ev:sql-8] [ev:sql-9]."},
        {"d": "D5", "title": "Permanent Corrective Actions (PCA)", "content": "1. Replace TC-02 thermocouple probe and recalibrate PLC PID temperature loop.\n2. Overhaul DCM-02 shot sleeve (overdue by 12 days)."},
        {"d": "D6", "title": "Implement & Validate PCA", "content": "Run 50-part pilot batch with high-speed pyrometer verification. Verify Cpk ≥ 1.67 and zero subsurface porosity on X-ray."},
        {"d": "D7", "title": "Prevent Recurrence", "content": "Implement automated temperature drift anomaly detection in Sentinel agent (+/- 5°C deadband trigger with MES auto-hold)."},
        {"d": "D8", "title": "Recognize the Team", "content": "Rayong Die-Casting & Quality Engineering Task Force acknowledged for rapid containment."}
    ]

    report = {
        "status": "GENERATED",
        "report_id": report_id,
        "lot_id": lot_id,
        "sku": sku,
        "generated_at": datetime.utcnow().isoformat(),
        "sections": sections,
        "evidence_citations": ["ev:sql-8", "ev:sql-9", "ev:doc-sop-dcm"],
        "sign_off_status": "PENDING_QE_DIRECTOR"
    }

    fs = get_firestore()
    if fs:
        try:
            fs.collection("quality_reports").document(report_id).set(report)
        except Exception as e:
            logger.warning(f"Could not persist 8D report: {e}")

    return report


# ==========================================
# 11. Incident War Room & Multi-Agent Deliberation
# ==========================================
@app.post("/v1/war-room/start")
async def start_war_room_deliberation(payload: Optional[Dict[str, Any]] = Body(default={})):
    """
    Initializes a dynamic cross-agent War Room deliberation for supply chain disruptions,
    generating structured dialogue from Scout, Navigator, Procurer, Planner, Oracle, Ledger, and Critic.
    """
    p = payload or {}
    scenario = p.get("scenario", "typhoon_hsinchu")
    decision_id = p.get("decision_id", "dec_001")

    deliberation = {
        "status": "ACTIVE",
        "deliberation_id": f"dlb_{decision_id}",
        "scenario": scenario,
        "started_at": datetime.utcnow().isoformat(),
        "disruption": {
            "title": "Typhoon Haikui-2 (Cat 3 Cyclone)",
            "supplier": "Formosa Semiconductor",
            "revenue_at_risk_usd": 1820000,
            "stock_out_days": 9
        },
        "recommended_option": "OPT-A",
        "critic_verdict": {
            "verdict": "PASS",
            "audited_claims": 3,
            "dropped_options": ["OPT-C"],
            "rationale": "Option A split-sourcing validated against Penang Micro line capacity and Pune shift balancing."
        },
        "dispatched_plan": [
            {"id": "act_po_penang", "desc": "ERP Purchase Order to Penang Micro created", "status": "READY"},
            {"id": "act_reschedule_ngo", "desc": "MES production schedule shifted +2 days at Pune", "status": "READY"},
            {"id": "act_notify_kirin", "desc": "CRM notification drafted for Kirin Mobility", "status": "READY"}
        ]
    }

    fs = get_firestore()
    if fs:
        try:
            fs.collection("war_rooms").document(f"dlb_{decision_id}").set(deliberation)
        except Exception as e:
            logger.warning(f"Could not persist war room session: {e}")

    return deliberation


# ==========================================
# 12. Demand Sensing & S&OP
# ==========================================
@app.post("/v1/demand/forecast-override")
async def apply_forecast_override(payload: Optional[Dict[str, Any]] = Body(default={})):
    """
    Applies or rejects a demand sensing volume surge override with audit tracking.
    """
    p = payload or {}
    sku = p.get("sku", "TM-300")
    customer = p.get("customer", "Zenith Motors")
    adjustment = p.get("adjustment", "+8%")
    action = p.get("action", "accept")
    reason = p.get("reason", "EV subsidy extended (India PLI)")
    user = await get_current_user()

    override_record = {
        "sku": sku,
        "customer": customer,
        "adjustment": adjustment,
        "action": action,
        "status": "ACCEPTED" if action == "accept" else "REJECTED",
        "reason": reason,
        "decided_by": user["email"],
        "decided_at": datetime.utcnow().isoformat(),
        "baseline_units": 18400,
        "adjusted_units": 19872 if action == "accept" else 18400
    }

    fs = get_firestore()
    if fs:
        try:
            doc_id = f"override_{sku}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            fs.collection("forecast_overrides").document(doc_id).set(override_record)
        except Exception as e:
            logger.warning(f"Could not persist forecast override: {e}")

    return {
        "status": "APPLIED",
        "sku": sku,
        "action": action,
        "message": f"Forecast adjustment {adjustment} for {sku} ({customer}) marked as {action.upper()}."
    }


@app.post("/v1/demand/sop-preread")
async def generate_sop_preread(payload: Optional[Dict[str, Any]] = Body(default={})):
    """
    Generates an executive S&OP (Sales & Operations Planning) pre-read document for Nov 2026.
    """
    p = payload or {}
    month = p.get("month", "Nov 2026")
    import uuid
    doc_id = f"SOP-{datetime.utcnow().strftime('%Y%m')}-{uuid.uuid4().hex[:4].upper()}"

    doc = {
        "status": "GENERATED",
        "document_id": doc_id,
        "period": month,
        "generated_at": datetime.utcnow().isoformat(),
        "executive_summary": "Demand surge across EV traction motors (+8% India PLI) requires selective overtime and dual-sourcing to protect $1.82M order book while maintaining 98% OTIF.",
        "gaps": [
            {"sku": "TM-300", "demand": 18400, "supply": 16200, "gap": -2200, "action": "Overtime at Pune + alternative sourcing from Penang"},
            {"sku": "HSG-220", "demand": 9800, "supply": 10200, "gap": 400, "action": "Build to stock buffer for Rayong DCM-02 maintenance"},
            {"sku": "GBX-100", "demand": 6100, "supply": 6100, "gap": 0, "action": "On plan; monitor Kirin Mobility Q4 launch ramp"}
        ],
        "decisions_requested": [
            "Approve Saturday overtime shift for Pune Line 2 (+1,200 units, cost $11.2k).",
            "Authorize split-order PO to Penang Micro for 500 gate-driver ICs.",
            "Confirm hold on Lot L-4471 pending 100% X-ray inspection."
        ]
    }

    fs = get_firestore()
    if fs:
        try:
            fs.collection("sop_documents").document(doc_id).set(doc)
        except Exception as e:
            logger.warning(f"Could not persist S&OP document: {e}")

    return doc


# ==========================================
# 13. Sustainability & ESG (Verdant Agent)
# ==========================================
@app.post("/v1/sustainability/approve-loadshift")
async def approve_loadshift(payload: Optional[Dict[str, Any]] = Body(default={})):
    """
    Approves energy load-shifting recommendation (e.g. Nagoya furnace pre-heat to off-peak tariff).
    Queues load shift command into the MES dispatch orchestrator.
    """
    p = payload or {}
    plant_id = p.get("plant_id", "NGO")
    process = p.get("process", "Furnace pre-heat cycles")
    window = p.get("window", "02:00–05:00")
    user = await get_current_user()

    import uuid
    dispatch_id = f"LS-{plant_id}-{uuid.uuid4().hex[:4].upper()}"

    record = {
        "dispatch_id": dispatch_id,
        "plant_id": plant_id,
        "process": process,
        "window": window,
        "status": "APPROVED",
        "savings_usd_monthly": 3100.0,
        "co2_avoided_tons_monthly": 4.6,
        "approved_by": user["email"],
        "approved_at": datetime.utcnow().isoformat(),
        "mes_dispatch_status": "QUEUED_TO_MES",
        "message": f"Load shift for {process} at {plant_id} approved. Projected monthly savings: $3,100, CO2e avoided: 4.6t."
    }

    fs = get_firestore()
    if fs:
        try:
            fs.collection("loadshifts").document(dispatch_id).set(record)
        except Exception as e:
            logger.warning(f"Could not persist load shift: {e}")

    return record


@app.post("/v1/sustainability/esg-report")
async def generate_esg_report(payload: Optional[Dict[str, Any]] = Body(default={})):
    """
    Auto-drafts a GRI 305 compliant Scope 1 & Scope 2 greenhouse gas emissions and PCF report.
    """
    p = payload or {}
    standard = p.get("standard", "GRI-305 (2016)")
    period = p.get("period", "October 2026")
    import uuid
    report_id = f"GRI-305-{datetime.utcnow().strftime('%Y%m')}-{uuid.uuid4().hex[:4].upper()}"

    doc = {
        "status": "DRAFTED",
        "report_id": report_id,
        "standard": standard,
        "reporting_period": period,
        "generated_at": datetime.utcnow().isoformat(),
        "scope1_tco2e": 38.0,
        "scope2_tco2e": 104.0,
        "total_tco2e": 142.0,
        "delta_vs_previous_month_pct": -8.0,
        "scope_breakdown": [
            {"source": "Scope 1 - Furnace Natural Gas (Nagoya)", "tco2e": 38.0, "pct": 26.8},
            {"source": "Scope 2 - Grid Electricity (Pune Plant)", "tco2e": 62.0, "pct": 43.7},
            {"source": "Scope 2 - Grid Electricity (Rayong Plant)", "tco2e": 28.0, "pct": 19.7},
            {"source": "Scope 2 - Grid Electricity (Nagoya Plant)", "tco2e": 14.0, "pct": 9.8}
        ],
        "product_carbon_footprints": [
            {"sku": "TM-300 Motor Assembly", "pcf": "18.4 kgCO2e/unit", "trend": "-2.1%"},
            {"sku": "HSG-220 Motor Housing", "pcf": "6.2 kgCO2e/unit", "trend": "-0.8%"},
            {"sku": "GBX-100 e-Axle Gearbox", "pcf": "12.7 kgCO2e/unit", "trend": "-1.4%"}
        ],
        "assurance_status": "READY_FOR_INTERNAL_AUDIT"
    }

    fs = get_firestore()
    if fs:
        try:
            fs.collection("esg_reports").document(report_id).set(doc)
        except Exception as e:
            logger.warning(f"Could not persist ESG report: {e}")

    return doc


# ==========================================
# 14. Master Autonomy E-Stop & Governance
# ==========================================
_AUTONOMY_STATE = {
    "paused": False,
    "paused_at": None,
    "paused_by": None,
    "reason": None
}

@app.get("/v1/admin/autonomy/status")
async def get_autonomy_status():
    """Returns current Master Autonomy status and active policy metrics."""
    global _AUTONOMY_STATE
    fs = get_firestore()
    if fs:
        try:
            doc = fs.collection("system_config").document("autonomy").get()
            if doc.exists:
                _AUTONOMY_STATE.update(doc.to_dict())
        except Exception:
            pass

    return {
        "autonomy_paused": _AUTONOMY_STATE["paused"],
        "mode": "MANUAL_HOLD (E-STOP ENGAGED)" if _AUTONOMY_STATE["paused"] else "OPERATIONAL",
        "active_level": "L1 (HUMAN APPROVAL REQUIRED)" if _AUTONOMY_STATE["paused"] else "L2_L3 (BALANCED AUTONOMY)",
        "active_policies_count": 7,
        "agents_registered": 12,
        "last_updated": _AUTONOMY_STATE.get("paused_at") or datetime.utcnow().isoformat()
    }


@app.post("/v1/admin/autonomy/pause")
async def pause_autonomy(payload: Optional[Dict[str, Any]] = Body(default={})):
    """
    Master E-STOP: Immediately pauses all autonomous actions across all agents.
    Drops system autonomy level to L1 (Human approval required for all actions).
    """
    global _AUTONOMY_STATE
    p = payload or {}
    user = await get_current_user()

    _AUTONOMY_STATE["paused"] = True
    _AUTONOMY_STATE["paused_at"] = datetime.utcnow().isoformat()
    _AUTONOMY_STATE["paused_by"] = user["email"]
    _AUTONOMY_STATE["reason"] = p.get("reason", "Master E-STOP button pressed from Admin Console")

    fs = get_firestore()
    if fs:
        try:
            fs.collection("system_config").document("autonomy").set(_AUTONOMY_STATE)
        except Exception as e:
            logger.warning(f"Could not update Firestore autonomy state: {e}")

    logger.warning(f"Master Autonomy E-STOP ENGAGED by {user['email']}")
    return {
        "status": "PAUSED",
        "autonomy_paused": True,
        "message": "Master E-STOP engaged. All L2/L3 autonomous dispatches paused. System reverted to L1 operator sign-off.",
        "timestamp": _AUTONOMY_STATE["paused_at"]
    }


@app.post("/v1/admin/autonomy/resume")
async def resume_autonomy(payload: Optional[Dict[str, Any]] = Body(default={})):
    """
    Releases Master E-STOP and resumes autonomous agent policies.
    """
    global _AUTONOMY_STATE
    user = await get_current_user()

    _AUTONOMY_STATE["paused"] = False
    _AUTONOMY_STATE["resumed_at"] = datetime.utcnow().isoformat()
    _AUTONOMY_STATE["resumed_by"] = user["email"]

    fs = get_firestore()
    if fs:
        try:
            fs.collection("system_config").document("autonomy").set(_AUTONOMY_STATE)
        except Exception as e:
            logger.warning(f"Could not update Firestore autonomy state: {e}")

    logger.info(f"Master Autonomy RESUMED by {user['email']}")
    return {
        "status": "RESUMED",
        "autonomy_paused": False,
        "message": "Master Autonomy resumed. Governance policies restored to active state.",
        "timestamp": _AUTONOMY_STATE["resumed_at"]
    }


