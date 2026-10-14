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


@app.get("/v1/kpis")
async def get_kpis(scope: str = "global"):
    """Returns live manufacturing KPIs (OEE, OTIF, MTBF, CO2, Downtime)."""
    # Baseline manufacturing KPIs per Section 19
    return {
        "scope": scope,
        "as_of": datetime.utcnow().isoformat(),
        "kpis": {
            "oee_pct": 78.4,
            "oee_trend": "-1.2%",
            "otif_pct": 94.2,
            "otif_target": 98.0,
            "mtbf_hours": 142.0,
            "mttr_hours": 2.4,
            "revenue_at_risk_usd": 793500.0,
            "co2_intensity_kg_per_unit": 18.2,
            "active_anomalies_count": 1,
            "pending_decisions_count": 1
        }
    }


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
async def list_insights(status: str = "new", limit: int = 20):
    """Feed of operational insights generated by Sentinel, Scout, and Inspector."""
    fs = get_firestore()
    live_insights = []
    if fs:
        try:
            docs = fs.collection("insights").limit(limit).stream()
            for doc in docs:
                d = doc.to_dict()
                if status == "all" or d.get("status") == status:
                    live_insights.append(d)
        except Exception as e:
            logger.warning(f"Error fetching insights from Firestore: {e}")

    if live_insights:
        return {"insights": live_insights}

    return {
        "insights": [
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
    }


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
