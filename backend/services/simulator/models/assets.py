import numpy as np

class AssetPhysics:
    def __init__(self, asset_id: str, plant_id: str, line_id: str):
        self.asset_id = asset_id
        self.plant_id = plant_id
        self.line_id = line_id
        self.is_degrading = False
        self.degradation_start_time = 0.0

    def inject_fault(self, sim_time: float):
        self.is_degrading = True
        self.degradation_start_time = sim_time

class CNCBearing(AssetPhysics):
    """
    Models a bearing on a CNC machine.
    Degradation math: a * (exp(b * (t - t0)) - 1) for vibration RMS.
    """
    def __init__(self, asset_id: str, plant_id: str, line_id: str):
        super().__init__(asset_id, plant_id, line_id)
        # Nominal baselines
        self.base_vib = 1.2  # mm/s
        self.base_kurtosis = 3.0
        self.base_temp = 45.0 # Celsius
        
        # Degradation coefficients
        self.a = 0.05
        self.b = 0.08  # Growth rate per simulated hour

    def get_readings(self, sim_time: float) -> list:
        # Add normal Gaussian noise
        vib = self.base_vib + np.random.normal(0, 0.1)
        kurtosis = self.base_kurtosis + np.random.normal(0, 0.2)
        temp = self.base_temp + np.random.normal(0, 0.5)

        # Apply exponential degradation if a fault is active
        if self.is_degrading:
            hours_since_fault = (sim_time - self.degradation_start_time) / 3600.0
            if hours_since_fault > 0:
                deg_factor = self.a * (np.exp(self.b * hours_since_fault) - 1)
                vib += deg_factor
                # Kurtosis spikes as impacts increase, then flattens out as damage spreads
                kurtosis += (deg_factor * 2) if hours_since_fault < 40 else (deg_factor * 0.5)
                # Temperature lags vibration
                temp += (deg_factor * 5)

        return [
            {"sensor_id": f"{self.asset_id}-VIB", "metric": "vib_rms", "value": round(vib, 3), "unit": "mm/s"},
            {"sensor_id": f"{self.asset_id}-KURT", "metric": "vib_kurtosis", "value": round(kurtosis, 3), "unit": "ratio"},
            {"sensor_id": f"{self.asset_id}-TEMP", "metric": "temp_c", "value": round(temp, 2), "unit": "C"}
        ]