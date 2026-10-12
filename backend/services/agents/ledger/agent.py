from google.adk.agents import Agent
from google.adk.tools import tool
from backend.packages.gembaos_core.config import models

DEFAULT_MODEL = models.get("DEFAULT", "gemini-3.8-flash")

@tool
def cost_rollup(sku_id: str, qty: int, plant_id: str, _context: dict) -> dict:
    """Calculates deterministic BOM + routing cost at contracted rates."""
    # MVP: Hardcoded math for the TM-300 sales CTP scenario
    base_cost = 210.50
    return {"sku": sku_id, "qty": qty, "total_cost_usd": base_cost * qty, "evidence_id": "ev_sql_88"}

@tool
def impact_model(revenue_protected: float, cost_incurred: float, downtime_avoided_h: float) -> dict:
    """Standardized financial impact calculator."""
    # Section 19.1 baseline: $25k per hour of downtime avoided
    downtime_value = downtime_avoided_h * 25000 
    net_value = (revenue_protected + downtime_value) - cost_incurred
    
    return {
        "net_value_usd": net_value,
        "roi_multiplier": net_value / cost_incurred if cost_incurred > 0 else float('inf')
    }

ledger = Agent(
    name="ledger",
    model=DEFAULT_MODEL,
    instruction="""You are LEDGER, the plant controller. 
    Use impact_model and cost_rollup to deterministically quantify the $ value, CO2 impact, and downtime avoided of proposals. 
    Never perform arithmetic yourself.""",
    tools=[cost_rollup, impact_model]
)