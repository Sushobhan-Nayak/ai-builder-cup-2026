import os
from pathlib import Path
from google.adk.agents import Agent
from google.adk.tools import BuiltInTool
from backend.packages.gembaos_core.config import models

DEFAULT_MODEL = models.get("DEFAULT", "gemini-3.8-flash")

# Load prompt from Appendix C
_prompt_path = Path(__file__).resolve().parent.parent / "prompts" / "live_web.md"
if _prompt_path.is_file():
    LIVE_WEB_INSTRUCTION = _prompt_path.read_text(encoding="utf-8")
else:
    LIVE_WEB_INSTRUCTION = "You are LIVE_WEB, the live external intelligence agent."

# Lane A Rule: This agent's ONLY tool is google_search (Section 7.7)
live_web = Agent(
    name="live_web",
    model=DEFAULT_MODEL,
    instruction=LIVE_WEB_INSTRUCTION,
    tools=[BuiltInTool("google_search")]
)