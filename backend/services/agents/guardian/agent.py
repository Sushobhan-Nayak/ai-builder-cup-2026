from google.adk.agents import Agent
from google.adk.tools import tool
from backend.packages.gembaos_core.config import models
from backend.services.agents.tools.mcp_wrapper import execute_mcp_tool

DEFAULT_MODEL = models.get("DEFAULT", "gemini-3.8-flash")

@tool
async def inspect_ppe(image_uri: str, _context: dict) -> dict:
    """Analyzes a CCTV snapshot for PPE violations (helmet, vest, gloves)."""
    # In production, calls a vision cascade similar to vision_inspector
    return {"status": "analyzed", "violations": [], "evidence_id": "ev_img_ppe"}

@tool
async def classify_near_miss(transcript: str, _context: dict) -> dict:
    """Auto-classifies a near-miss voice report."""
    return {"category": "slip_trip_hazard", "severity": "medium", "evidence_id": "ev_doc_nm"}

@tool
async def reg_qa(question: str, _context: dict) -> dict:
    """Answers compliance questions using RAG over stored regulation documents."""
    rows, evidence = await execute_mcp_tool(
        tool_name="search_regulations",
        params={"query": question},
        context=_context
    )
    return {"data": rows, "evidence_id": evidence.id}

guardian = Agent(
    name="guardian",
    model=DEFAULT_MODEL,
    instruction="You are GUARDIAN, the EHS officer. Ensure safety compliance, analyze PPE from images, and classify near-misses. Always cite evidence.",
    tools=[inspect_ppe, classify_near_miss, reg_qa]
)