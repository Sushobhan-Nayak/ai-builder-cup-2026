from google.adk.agents import Agent
from google.adk.tools import tool

from backend.packages.gembaos_core.config import models
from backend.services.agents.tools.mcp_wrapper import execute_mcp_tool

DEFAULT_MODEL = models.get("DEFAULT", "gemini-3.8-flash")

ORACLE_INSTRUCTION = """
You are ORACLE, the root-cause analysis and diagnostic reasoning agent.
Synthesize findings across historical maintenance logs, telemetry patterns, and equipment manuals.
Always cite evidence IDs for your conclusions.
"""

oracle = Agent(
    name="oracle",
    model=DEFAULT_MODEL,
    instruction=ORACLE_INSTRUCTION,
    tools=[]
)

