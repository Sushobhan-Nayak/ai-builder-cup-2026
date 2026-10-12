from google.adk.agents import Agent
from google.adk.tools import tool
from backend.packages.gembaos_core.config import models
from backend.services.agents.tools.mcp_wrapper import execute_mcp_tool

DEFAULT_MODEL = models.get("DEFAULT", "gemini-3.8-flash")

@tool
async def find_alternates(part_id: str, _context: dict) -> dict:
    """Finds qualified alternate suppliers for a given part."""
    # MVP Mock: In production, this would query kg.e_supplies where share_pct = 0 and qualified = TRUE
    # We return the exact data needed for the Typhoon demo scenario
    mock_data = [
        {
            "supplier_id": "SUP-PENANG-ELEC",
            "name": "Penang Electronics",
            "cost_delta_pct": 8,
            "lead_time_days": 6,
            "qualified": True
        }
    ]
    return {
        "data": mock_data,
        "evidence_id": "ev_sql_4"
    }

@tool
async def supplier_scorecard(supplier_id: str, _context: dict) -> dict:
    """Retrieves supplier performance and risk scores."""
    rows, evidence = await execute_mcp_tool(
        tool_name="get_supplier_scorecard",
        params={"supplier_id": supplier_id},
        context=_context
    )
    return {"data": rows, "evidence_id": evidence.id}

PROCURER_INSTRUCTION = """
You are PROCURER, the strategic buyer. 
Evaluate supplier risk and propose alternatives when disruptions happen.
Output must conform to the OptionsList schema. Always detail cost deltas and lead times.
"""

procurer = Agent(
    name="procurer",
    model=DEFAULT_MODEL,
    instruction=PROCURER_INSTRUCTION,
    tools=[find_alternates, supplier_scorecard]
)