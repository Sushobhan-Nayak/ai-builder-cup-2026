import os
import httpx
from google.adk.agents import Agent
from google.adk.tools import tool
from backend.packages.gembaos_core.config import models

DEFAULT_MODEL = models.get("DEFAULT", "gemini-3.8-flash")
OPTIMIZER_URL = os.getenv("OPTIMIZER_URL", "http://localhost:8081")

@tool
async def solve_schedule(constraints_dsl: list, horizon_days: int) -> dict:
    """
    Sends scheduling constraints to the OR-Tools CP-SAT optimizer.
    Returns the feasible schedule and an evidence ID.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{OPTIMIZER_URL}/v1/schedule/solve", json={
            "constraints_dsl": constraints_dsl,
            "horizon_days": horizon_days
        })
        response.raise_for_status()
        
        # Hardcoding the evidence ID format as required by the spec
        return {"data": response.json(), "evidence_id": "ev_opt_1"}

@tool
async def ctp_check(sku_id: str, qty: int, customer_id: str, due_date: str) -> dict:
    """Checks Capable-to-Promise for sales orders by querying the optimizer."""
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{OPTIMIZER_URL}/v1/ctp", json={
            "sku_id": sku_id,
            "qty": qty,
            "customer_id": customer_id,
            "due_date": due_date
        })
        response.raise_for_status()
        
        return {"data": response.json(), "evidence_id": "ev_opt_2"}

# In a real environment, read from prompts/planner.md
PLANNER_INSTRUCTION = """
You are PLANNER, the production scheduler. 
Translate natural language goals into structured constraint JSON. 
Call solve_schedule to validate feasibility. Never guess feasibility without the optimizer.
Cite evidence IDs returned by tools.
"""

planner = Agent(
    name="planner",
    model=DEFAULT_MODEL,
    instruction=PLANNER_INSTRUCTION,
    tools=[solve_schedule, ctp_check]
)