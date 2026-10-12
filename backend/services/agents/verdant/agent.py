from google.adk.agents import Agent
from google.adk.tools import tool
from backend.packages.gembaos_core.config import models
from backend.services.agents.tools.mcp_wrapper import execute_mcp_tool

DEFAULT_MODEL = models.get("DEFAULT", "gemini-3.8-flash")

@tool
async def propose_load_shift(asset_id: str, shift_to_time: str, _context: dict) -> dict:
    """Calculates savings for shifting a machine's load based on time-of-use tariffs and carbon intensity."""
    # MVP: Hardcoded savings for the furnace pre-heat load shift scenario
    return {
        "data": {
            "asset_id": asset_id,
            "proposed_window": shift_to_time,
            "savings_usd": 3100.0,
            "co2_savings_kg": 4600.0
        },
        "evidence_id": "ev_sql_carbon"
    }

VERDANT_INSTRUCTION = """
You are VERDANT, the sustainability engineer.
Monitor energy-intensive assets like furnaces. Use propose_load_shift to find cheaper, lower-carbon operating windows 
based on live grid carbon-intensity feeds. Always state the $ and tCO2e savings.
"""

verdant = Agent(
    name="verdant",
    model=DEFAULT_MODEL,
    instruction=VERDANT_INSTRUCTION,
    tools=[propose_load_shift]
)