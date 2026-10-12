import os
import uuid
import httpx
from datetime import datetime
from typing import Dict, Any, Tuple

from backend.packages.gembaos_core.schemas.agents import Evidence

MCP_URL = os.getenv("MCP_URL", "http://localhost:5000")

async def execute_mcp_tool(tool_name: str, params: Dict[str, Any], context: Dict[str, Any]) -> Tuple[list, Evidence]:
    """
    Executes an MCP tool, injecting plant-level security scoping and generating an Evidence record.
    """
    # 1. Inject security context (Rule: Agents never choose allowed_plants themselves)
    allowed_plants = context.get("allowed_plants", [])
    if not allowed_plants:
        raise ValueError("Security Context Error: allowed_plants is missing.")
    
    payload = {
        "parameters": {
            **params,
            "allowed_plants": allowed_plants
        }
    }

    # 2. Call the MCP Sidecar API
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{MCP_URL}/v1/tools/{tool_name}/execute", json=payload)
        response.raise_for_status()
        result_data = response.json()

    rows = result_data.get("rows", [])
    query_executed = result_data.get("statement", "N/A")

    # 3. Generate the Evidence record (Appendix A, Rule 3)
    evidence_id = f"ev_sql_{uuid.uuid4().hex[:6]}"
    
    evidence = Evidence(
        id=evidence_id,
        type="sql" if "graph_" not in tool_name else "gql",
        source="bq://mcp_toolbox",
        tool=tool_name,
        params=params,
        query=query_executed,
        row_count=len(rows),
        summary=f"Retrieved {len(rows)} records using {tool_name}.",
        payload_ref="inline", # Truncated/inline for MVP
        ts=datetime.utcnow()
    )

    # In production, we would asynchronously write this to ai.evidence in BigQuery/Firestore here
    
    return rows, evidence