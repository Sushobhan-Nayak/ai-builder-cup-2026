from google.adk.agents import Agent
from google.adk.tools import tool
from backend.packages.gembaos_core.config import models
from backend.services.agents.tools.mcp_wrapper import execute_mcp_tool

DEFAULT_MODEL = models.get("DEFAULT", "gemini-3.8-flash")

@tool
async def graph_blast_radius_supplier(supplier_id: str, _context: dict) -> dict:
    """
    Calculates supply chain blast radius using the BigQuery Graph tool in MCP.
    """
    rows, evidence = await execute_mcp_tool(
        tool_name="graph_blast_radius_supplier",
        params={"supplier_id": supplier_id},
        context=_context
    )
    return {"data": rows, "evidence_id": evidence.id}

@tool
async def get_inventory_position(sku_id: str, _context: dict) -> dict:
    """Fetches real-time inventory days of cover."""
    rows, evidence = await execute_mcp_tool(
        tool_name="get_inventory_position",
        params={"sku_id": sku_id},
        context=_context
    )
    return {"data": rows, "evidence_id": evidence.id}

NAVIGATOR_INSTRUCTION = """
You are NAVIGATOR, the supply chain analyst. 
When a disruption occurs, use graph_blast_radius_supplier to find affected parts, orders, and revenue.
Always cite the [ev:gql_x] evidence ID in your analysis.
"""

navigator = Agent(
    name="navigator",
    model=DEFAULT_MODEL,
    instruction=NAVIGATOR_INSTRUCTION,
    tools=[graph_blast_radius_supplier, get_inventory_position]
)