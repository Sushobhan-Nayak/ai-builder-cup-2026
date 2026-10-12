from datetime import datetime
from typing import Any, Dict, List, Optional
try:
    from pydantic import BaseModel, Field
except ImportError:
    # Minimal fallback if pydantic is not installed
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def dict(self):
            return self.__dict__
    def Field(default=None, default_factory=None, **kwargs):
        if default_factory is not None:
            return default_factory()
        return default

class Evidence(BaseModel):
    id: str
    type: str = "sql"
    source: str = "bq://mcp_toolbox"
    tool: str = ""
    params: Dict[str, Any] = Field(default_factory=dict)
    query: str = "N/A"
    row_count: int = 0
    summary: str = ""
    payload_ref: str = "inline"
    ts: datetime = Field(default_factory=datetime.utcnow)

class OptionsList(BaseModel):
    options: List[Dict[str, Any]] = Field(default_factory=list)

