from google.adk.agents import Agent
from google.adk.tools import tool
from backend.packages.gembaos_core.config import models
from backend.services.agents.tools.mcp_wrapper import execute_mcp_tool
import uuid

# Mentor can operate via text or voice (via the Live API)
DEFAULT_MODEL = models.get("DEFAULT", "gemini-3.8-flash")

@tool
async def get_sop(asset_id: str, task: str, _context: dict) -> dict:
    """Retrieves step-by-step Standard Operating Procedures using Vector Search."""
    rows, evidence = await execute_mcp_tool(
        tool_name="search_sops",
        params={"asset_id": asset_id, "task": task},
        context=_context
    )
    return {"data": rows, "evidence_id": evidence.id}

@tool
async def save_knowledge(asset_id: str, symptom: str, cause: str, fix: str, _context: dict) -> dict:
    """Saves a structured tribal knowledge note after a repair is completed."""
    note_id = f"kn_{uuid.uuid4().hex[:8]}"
    # MVP: Mocking the database write
    return {"status": "saved", "note_id": note_id, "evidence_id": f"ev_doc_{note_id}"}

@tool
async def skills_match(task: str, _context: dict) -> dict:
    """Recommends technicians based on their skills matrix."""
    return {"recommended_technicians": ["Arjun", "Kenji"], "evidence_id": "ev_sql_skills"}

mentor = Agent(
    name="mentor",
    model=DEFAULT_MODEL,
    instruction="You are MENTOR, the master technician. Provide accurate SOPs and capture tribal knowledge debriefs after repairs.",
    tools=[get_sop, save_knowledge, skills_match]
)