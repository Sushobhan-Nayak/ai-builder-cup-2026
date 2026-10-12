import os
from pathlib import Path
from google.adk.agents import Agent
from google.adk.tools import tool
from backend.packages.gembaos_core.config import models
from backend.services.agents.tools.mcp_wrapper import execute_mcp_tool

DEFAULT_MODEL = models.get("DEFAULT", "gemini-3.8-flash")

@tool
async def check_sensor_history(asset_id: str, minutes: int, _context: dict) -> dict:
    """Fetches recent sensor telemetry and returns data with an evidence ID."""
    rows, evidence = await execute_mcp_tool(
        tool_name="get_asset_sensor_window",
        params={"asset_id": asset_id, "minutes": minutes},
        context=_context
    )
    return {"data": rows, "evidence_id": evidence.id}

@tool
async def check_spare_parts(part_id: str, _context: dict) -> dict:
    """Checks inventory for a required part and returns data with an evidence ID."""
    rows, evidence = await execute_mcp_tool(
        tool_name="get_spare_stock",
        params={"part_id": part_id},
        context=_context
    )
    return {"data": rows, "evidence_id": evidence.id}

# Load the prompt template defined in Section 8.6
_prompt_path = Path(__file__).resolve().parent.parent / "prompts" / "sentinel.md"
if _prompt_path.is_file():
    sentinel_instruction = _prompt_path.read_text(encoding="utf-8")
else:
    sentinel_instruction = "You are SENTINEL, the predictive maintenance engineer."

sentinel = Agent(
    name="sentinel",
    model=DEFAULT_MODEL,
    instruction=sentinel_instruction,
    tools=[check_sensor_history, check_spare_parts]
)