import simpy
import asyncio
import uuid
import logging
from datetime import datetime, timedelta
try:
    from backend.services.simulator.publishers import publisher
    from backend.services.simulator.models.assets import CNCBearing
except ImportError:
    try:
        from .publishers import publisher
        from .models.assets import CNCBearing
    except ImportError:
        from publishers import publisher
        from models.assets import CNCBearing

logger = logging.getLogger(__name__)

class FactorySimulator:
    def __init__(self):
        self.env = simpy.Environment()
        self.is_running = False
        self.speed_multiplier = 1 # 1x for real-time, 60x for demo
        self.start_wall_time = datetime.utcnow()
        self.start_sim_time = self.start_wall_time
        
        # Initialize factory assets
        self.assets = {
            "PNQ-CNC-07": CNCBearing("PNQ-CNC-07", "PNQ", "PNQ-L1")
        }

    def _current_ts(self) -> datetime:
        return datetime.utcnow()

    def _current_sim_ts(self) -> datetime:
        """Calculates simulated plant time based on elapsed wall time and speed multiplier."""
        elapsed_real_seconds = (self._current_ts() - self.start_wall_time).total_seconds()
        sim_elapsed_seconds = elapsed_real_seconds * self.speed_multiplier
        return self.start_sim_time + timedelta(seconds=sim_elapsed_seconds)

    async def _telemetry_loop(self):
        """Emits 1Hz telemetry per real second, scaled to represent a simulated minute at 60x."""
        while self.is_running:
            ts = self._current_ts()
            sim_ts = self._current_sim_ts()
            
            for asset_id, asset in self.assets.items():
                readings = asset.get_readings(sim_time=self.env.now)
                for r in readings:
                    publisher.publish_telemetry(
                        event_id=f"evt_tel_{uuid.uuid4().hex[:8]}",
                        ts=ts,
                        sim_ts=sim_ts,
                        plant_id=asset.plant_id,
                        line_id=asset.line_id,
                        asset_id=asset.asset_id,
                        sensor_id=r["sensor_id"],
                        metric=r["metric"],
                        value=r["value"],
                        unit=r["unit"]
                    )
            
            # Step the simpy environment forward by the simulated time delta
            self.env.run(until=self.env.now + self.speed_multiplier)
            await asyncio.sleep(1.0) # 1 real second tick

    def start(self, speed_multiplier: int = 1, force_sim_start_time: datetime = None):
        self.speed_multiplier = speed_multiplier
        self.start_wall_time = datetime.utcnow()
        self.start_sim_time = force_sim_start_time or self.start_wall_time
        self.is_running = True
        asyncio.create_task(self._telemetry_loop())
        logger.info(f"Simulator started at {self.speed_multiplier}x speed.")

    def reset(self):
        self.is_running = False
        self.env = simpy.Environment()
        self.assets["PNQ-CNC-07"] = CNCBearing("PNQ-CNC-07", "PNQ", "PNQ-L1")
        logger.info("Simulator reset.")

    def trigger_bearing_fault(self, asset_id: str):
        if asset_id in self.assets:
            self.assets[asset_id].inject_fault(self.env.now)
            logger.info(f"Injected bearing fault on {asset_id}")

simulator = FactorySimulator()