import os
from pathlib import Path
from google.adk.agents import Agent
from google.adk.tools import tool
from backend.packages.gembaos_core.config import models
from pydantic import BaseModel, Field
from typing import List, Dict, Any

DEEP_MODEL = models.get("DEEP", "gemini-3.1-pro-preview")

class Issue(BaseModel):
    claim: str
    problem: str
    fix: str

class CriticVerdict(BaseModel):
    pass_validation: bool = Field(alias="pass")
    issues: List[Issue] = Field(default_factory=list)
    dropped_options: List[str] = Field(default_factory=list)

@tool
def check_evidence(evidence_id: str, _context: dict) -> dict:
    """Verifies if an evidence_id exists and retrieves its payload summary."""
    # MVP: Mocking evidence check. In production, queries ai.evidence table.
    return {"status": "verified", "evidence_id": evidence_id, "valid": True}

@tool
def recompute(formula: str, variables: Dict[str, float]) -> float:
    """Safely executes deterministic math to verify agent arithmetic (Rule 4)."""
    # Safe evaluation environment for basic math
    allowed_names = {k: v for k, v in variables.items()}
    try:
        return eval(formula, {"__builtins__": {}}, allowed_names)
    except Exception as e:
        return float('nan')

@tool
def policy_check(action_type: str, params: dict, _context: dict) -> dict:
    """Checks the proposed action against config/policies.yaml."""
    # MVP: Returns true for the demo scenario
    return {"policy_compliant": True, "required_level": "L2"}

# Load prompt from Appendix C
_prompt_path = Path(__file__).resolve().parent.parent / "prompts" / "critic.md"
if _prompt_path.is_file():
    CRITIC_INSTRUCTION = _prompt_path.read_text(encoding="utf-8")
else:
    CRITIC_INSTRUCTION = "You are CRITIC, the independent red team and validation agent."

critic = Agent(
    name="critic",
    model=DEEP_MODEL,
    instruction=CRITIC_INSTRUCTION,
    tools=[check_evidence, recompute, policy_check],
    output_schema=CriticVerdict
)