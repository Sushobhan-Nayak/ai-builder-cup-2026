from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
import uuid
try:
    from backend.services.simulator.engine import simulator
    from backend.services.simulator.publishers import publisher
except ImportError:
    try:
        from .engine import simulator
        from .publishers import publisher
    except ImportError:
        from engine import simulator
        from publishers import publisher

app = FastAPI(title="GembaOS Simulator & Demo Director", version="1.4")

class ScenarioConfig(BaseModel):
    speed_multiplier: int = 60

@app.post("/v1/demo/scenarios/{name}/start")
async def start_scenario(name: str, config: ScenarioConfig):
    """Demo Director endpoint to start seeded scenarios."""
    simulator.reset()
    
    if name == "bearing_failure_cnc07":
        # Force sim clock to Wednesday 07:00 as required by the storyboard
        # so Thursday 14:00 maintenance window falls before P10 RUL
        wednesday_0700 = datetime.utcnow().replace(hour=7, minute=0, second=0, microsecond=0)
        while wednesday_0700.weekday() != 2: # 2 = Wednesday
            wednesday_0700 += timedelta(days=1)
            
        simulator.start(speed_multiplier=config.speed_multiplier, force_sim_start_time=wednesday_0700)
        # Inject fault at T+0
        simulator.trigger_bearing_fault("PNQ-CNC-07")
        return {"status": "started", "scenario": name, "sim_time": wednesday_0700.isoformat()}

    elif name == "typhoon_hsinchu":
        simulator.start(speed_multiplier=config.speed_multiplier)
        
        # Inject Lane B scenario signal
        signal_payload = {
            "event_id": f"evt_sig_{uuid.uuid4().hex[:8]}",
            "signal_id": f"sig_typhoon_{uuid.uuid4().hex[:8]}",
            "ts": datetime.utcnow().isoformat(),
            "type": "weather",
            "geo": {"type": "Point", "coordinates": [121.0, 24.8]}, # Near Hsinchu
            "entities": [{"type": "supplier", "id": "SUP-FORMOSA"}, {"type": "region", "id": "REG-TW"}],
            "severity": 4,
            "probability": 0.8,
            "time_horizon_h": 48,
            "sources": ["scenario"],
            "summary": "Typhoon Haikui-2 forecast to impact Hsinchu region.",
            "source_feed": "scenario",
            "retrieved_at": datetime.utcnow().isoformat(),
            "as_of": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(days=2)).isoformat(),
            "is_scenario": True,
            "plant_ids": ["PNQ", "RYG", "NGO"]
        }
        publisher.publish_signal(signal_payload)
        return {"status": "started", "scenario": name, "signal_injected": True}

    raise HTTPException(status_code=404, detail="Scenario not found")

@app.post("/v1/demo/reset")
async def reset_demo():
    """Stops the simulator and resets state."""
    simulator.reset()
    return {"status": "reset"}