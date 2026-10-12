from google.adk.agents import Agent
from google.adk.tools import tool
from backend.packages.gembaos_core.config import models
from backend.services.agents.tools.mcp_wrapper import execute_mcp_tool

VISION_MODEL = models.get("VISION", "gemini-3.8-flash")

@tool
async def correlate_params(defect_type: str, time_window: str, _context: dict) -> dict:
    """Correlates defect rates with process parameters (e.g., die temperature drift)."""
    rows, evidence = await execute_mcp_tool(
        tool_name="get_defect_correlations",
        params={"defect_type": defect_type, "time_window": time_window},
        context=_context
    )
    return {"data": rows, "evidence_id": evidence.id}

@tool
async def draft_8d(lot_id: str, defect_type: str, _context: dict) -> dict:
    """Drafts an 8D report (D1-D4) for a specific defect and lot."""
    # MVP: Mocking the document generation
    return {
        "data": {"status": "drafted", "lot": lot_id, "containment": "100% X-ray inspection of lot"},
        "evidence_id": "ev_doc_8d"
    }

INSPECTOR_INSTRUCTION = """
You are INSPECTOR, the quality engineer.
When visual defects are detected (like porosity), use correlate_params to find the root cause (e.g., die-temperature drift).
Draft RCA/8D containment plans using draft_8d. Always cite evidence.
"""

inspector = Agent(
    name="inspector",
    model=VISION_MODEL,
    instruction=INSPECTOR_INSTRUCTION,
    tools=[correlate_params, draft_8d]
)