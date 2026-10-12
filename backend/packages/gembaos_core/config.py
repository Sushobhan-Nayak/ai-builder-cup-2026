import os
from pathlib import Path

DEFAULT_MODELS = {
    "DEFAULT": "gemini-3.8-flash",
    "CHAT": "gemini-3.8-flash",
    "DEEP": "gemini-3.1-pro-preview",
    "FAST": "gemini-3.5-flash-lite",
    "VISION": "gemini-3.8-flash",
    "LIVE": "gemini-3.8-live",
    "EMBED": "gemini-embedding-2",
    "IMAGE": "gemini-3.1-flash-image",
}

class ModelRegistry(dict):
    """
    Registry for model configurations loaded from config/models.yaml.
    Provides dict-like and .get() access returning model ID strings.
    """
    def __init__(self):
        super().__init__(DEFAULT_MODELS)
        self._load_from_yaml()

    def _load_from_yaml(self):
        # Look for models.yaml in standard locations
        candidates = [
            Path(os.getenv("CONFIG_DIR", "")) / "models.yaml",
            Path(__file__).resolve().parent.parent.parent / "config" / "models.yaml",
            Path("config/models.yaml"),
            Path("backend/config/models.yaml"),
        ]
        for p in candidates:
            if p.is_file():
                try:
                    import yaml
                    with open(p, "r", encoding="utf-8") as f:
                        data = yaml.safe_load(f) or {}
                    raw_models = data.get("models", {})
                    for k, v in raw_models.items():
                        if isinstance(v, dict) and "id" in v:
                            self[k] = v["id"]
                        elif isinstance(v, str):
                            self[k] = v
                    break
                except Exception:
                    pass

    def get(self, key, default=None):
        return super().get(key, default)

models = ModelRegistry()

