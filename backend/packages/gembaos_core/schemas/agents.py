from datetime import datetime
from typing import Any, Dict, List, Optional
try:
    from pydantic import BaseModel, Field
except ImportError:
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
    uri: Optional[str] = None

class Action(BaseModel):
    type: str
    params: Dict[str, Any] = Field(default_factory=dict)

class ActionOption(BaseModel):
    id: str = "A"
    title: str = ""
    actions: List[Action] = Field(default_factory=list)
    impact: Dict[str, Any] = Field(default_factory=dict)
    risks: List[str] = Field(default_factory=list)
    feasible: bool = True
    evidence_ids: List[str] = Field(default_factory=list)

class OptionsList(BaseModel):
    options: List[ActionOption] = Field(default_factory=list)

class Insight(BaseModel):
    id: str
    ts: datetime = Field(default_factory=datetime.utcnow)
    plant_ids: List[str] = Field(default_factory=list)
    domain: str = "maintenance"
    severity: str = "medium"
    title: str
    summary: str
    entities: List[Dict[str, str]] = Field(default_factory=list)
    confidence: float = 1.0
    impact: Dict[str, Any] = Field(default_factory=dict)
    evidence_ids: List[str] = Field(default_factory=list)
    agent: str = "sentinel"
    status: str = "new"

class Recommendation(BaseModel):
    id: str
    insight_id: str
    options: List[ActionOption] = Field(default_factory=list)
    recommended_option: str = "A"
    rationale: str = ""
    autonomy_level: str = "L2"
    approvers: List[str] = Field(default_factory=list)
    expires_at: Optional[datetime] = None

class Decision(BaseModel):
    decision_id: str
    recommendation_id: str
    option_id: str
    status: str = "approved"
    decided_by: str = ""
    decided_at: datetime = Field(default_factory=datetime.utcnow)
    comment: str = ""
    modifications: Dict[str, Any] = Field(default_factory=dict)
    autonomy_level: str = "L2"
    est_value_usd: float = 0.0
    realized_value_usd: float = 0.0
    plant_ids: List[str] = Field(default_factory=list)

class SentinelAssessment(BaseModel):
    is_real: bool = True
    confidence: float = 0.95
    failure_modes: List[Dict[str, Any]] = Field(default_factory=list)
    rul_hours: Dict[str, float] = Field(default_factory=dict)
    recommendation: Dict[str, Any] = Field(default_factory=dict)
    narrative: str = ""

class InspectionResult(BaseModel):
    is_defect: bool = False
    defect_type: str = "none"
    severity: str = "none"
    boxes: List[Dict[str, Any]] = Field(default_factory=list)
    confidence: float = 1.0
    rationale: str = ""

class Signal(BaseModel):
    signal_id: str
    ts: datetime = Field(default_factory=datetime.utcnow)
    type: str = "weather"
    geo: Optional[Dict[str, Any]] = None
    entities: List[Dict[str, Any]] = Field(default_factory=list)
    severity: int = 3
    probability: float = 0.8
    time_horizon_h: int = 48
    sources: List[str] = Field(default_factory=list)
    summary: str = ""
    source_feed: str = "scenario"
    plant_ids: List[str] = Field(default_factory=list)
    retrieved_at: datetime = Field(default_factory=datetime.utcnow)
    as_of: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    is_scenario: bool = True

class DecisionBriefDraft(BaseModel):
    brief_id: str
    title: str
    summary: str
    options: List[ActionOption] = Field(default_factory=list)
    recommended_option: str = "A"
