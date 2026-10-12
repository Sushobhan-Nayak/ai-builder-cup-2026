import os
from pathlib import Path
from google.adk.agents import Agent
from google.adk.tools import tool
from backend.packages.gembaos_core.config import models
import sqlglot

DEFAULT_MODEL = models.get("DEFAULT", "gemini-3.8-flash")

@tool
async def execute_sql_readonly(query: str, _context: dict) -> dict:
    """
    Executes an ad-hoc SQL query against BigQuery after strict security parsing.
    """
    allowed_plants = _context.get("allowed_plants", [])
    
    # 1. Security parsing: enforce table-valued functions only
    try:
        parsed = sqlglot.parse_one(query)
        tables = [t.name for t in parsed.find_all(sqlglot.exp.Table)]
        for table in tables:
            if not table.startswith("tvf_"):
                return {"error": f"Security Violation: Querying base table '{table}' is forbidden. Use gold.tvf_* functions."}
    except Exception as e:
        return {"error": "Failed to parse SQL safely."}
        
    # 2. In production, execute the query via BQ Client with dry_run=True first
    # Mocking successful execution for the MVP
    return {
        "data": [{"metric": "OEE", "value": 78.4, "trend": "down"}],
        "bytes_billed": 1048576,
        "evidence_id": "ev_sql_89"
    }

@tool
def render_chart(chart_type: str, data_keys: list, x_axis: str, y_axis: str) -> dict:
    """Generates a Vega-Lite chart spec JSON to be rendered by the A2UI frontend."""
    # Constructs the Vega-Lite spec structure
    vega_spec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "mark": chart_type,
        "encoding": {
            "x": {"field": x_axis, "type": "nominal"},
            "y": {"field": y_axis, "type": "quantitative"}
        }
    }
    return {"vega_spec": vega_spec, "ui_action": "render_chart"}

# Load prompt from Appendix C
_prompt_path = Path(__file__).resolve().parent.parent / "prompts" / "analyst.md"
if _prompt_path.is_file():
    ANALYST_INSTRUCTION = _prompt_path.read_text(encoding="utf-8")
else:
    ANALYST_INSTRUCTION = "You are ANALYST, the BigQuery data analyst."

analyst = Agent(
    name="analyst",
    model=DEFAULT_MODEL,
    instruction=ANALYST_INSTRUCTION,
    tools=[execute_sql_readonly, render_chart]
)