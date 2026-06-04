"""
app/ml/model_registry.py
─────────────────────────
Central ML model registry with lazy loading and thread-safe singleton pattern.

All models are loaded ONCE during application startup via the `load_all_models()`
function called from the FastAPI lifespan handler.  Routes access models through
`ModelRegistry.get()` so they never deal with file I/O.

Adding a new model:
  1. Define a loader function below (load_*)
  2. Register it in `_LOADERS`
  3. Access it via `ModelRegistry.get("my_model_key")`
"""

import asyncio
import pickle
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.exceptions import ModelNotLoadedException
from app.core.logging import get_logger

logger = get_logger(__name__)

_MODEL_LOAD_TIMEOUT_SECONDS = 120.0  # YOLO needs 30-60s on Render cold start

# ── Type aliases ───────────────────────────────────────────────────────────────
ModelKey = str
ModelObject = Any  # sklearn Pipeline | YOLO | torch.nn.Module etc.


class ModelRegistry:
    """
    Thread-safe, in-process model store.

    All models live in ``_store`` as a plain dict; lookups are O(1).
    Loading is done once at startup—never per-request.
    """

    _store: dict[ModelKey, ModelObject] = {}
    _lock = asyncio.Lock()

    @classmethod
    async def register(cls, key: ModelKey, model: ModelObject) -> None:
        async with cls._lock:
            cls._store[key] = model
            logger.info("Model registered", extra={"key": key, "type": type(model).__name__})

    @classmethod
    def get(cls, key: ModelKey) -> ModelObject:
        """
        Retrieve a loaded model.  Raises ``ModelNotLoadedException`` if absent
        so callers don't need to guard against None.
        """
        model = cls._store.get(key)
        if model is None:
            raise ModelNotLoadedException(model_name=key)
        return model

    @classmethod
    def is_loaded(cls, key: ModelKey) -> bool:
        return key in cls._store

    @classmethod
    def list_models(cls) -> list[dict[str, str]]:
        return [
            {"key": k, "type": type(v).__name__}
            for k, v in cls._store.items()
        ]


# ── Individual loaders ─────────────────────────────────────────────────────────

def _load_pickle(path: Path, label: str) -> Any:
    """Load a scikit-learn / joblib-style pickle model."""
    if not path.exists():
        logger.warning("Model file not found – using stub", extra={"path": str(path)})
        return None  # stub: prevents crash when model file is absent in dev
    
    import joblib
    model = joblib.load(str(path))
    logger.info("Pickle model loaded", extra={"label": label, "path": str(path)})
    return model


def _load_yolo(path: Path) -> Any:
    """
    Load YOLOv8 model via the `ultralytics` library.
    Falls back to None stub when the library or model file is absent.
    """
    if not path.exists():
        logger.warning("YOLO model file not found – using stub", extra={"path": str(path)})
        return None

    try:
        from ultralytics import YOLO  # type: ignore[import]
        model = YOLO(str(path))
        logger.info("YOLOv8 model loaded", extra={"path": str(path)})
        return model
    except ImportError:
        logger.warning(
            "ultralytics package not installed – roof detection will use stub responses"
        )
        return None


# ── Public entry-point ─────────────────────────────────────────────────────────

async def load_all_models() -> None:
    """
    Load every ML model during application startup.
    Run in a thread executor so blocking I/O doesn't stall the event loop.
    """
    loop = asyncio.get_event_loop()

    async def _load_with_timeout(
        key: str,
        loader: Any,
        *loader_args: Any,
    ) -> Any:
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(None, loader, *loader_args),
                timeout=_MODEL_LOAD_TIMEOUT_SECONDS,
            )
        except Exception as exc:
            logger.warning(
                "Model load failed or timed out — using stub",
                extra={"key": key, "error": str(exc)},
            )
            return None

    # Solar Forecast Model (Random Forest)
    rf_model = await _load_with_timeout(
        "solar_forecast",
        _load_pickle,
        settings.SOLAR_FORECAST_MODEL_PATH,
        "solar_forecast_rf",
    )
    await ModelRegistry.register("solar_forecast", rf_model)

    # Savings Prediction Model
    savings_model = await _load_with_timeout(
        "savings",
        _load_pickle,
        settings.SAVINGS_MODEL_PATH,
        "savings_model",
    )
    await ModelRegistry.register("savings", savings_model)

    # YOLOv8 Roof Detection Model
    yolo_model = await _load_with_timeout(
        "roof_detection",
        _load_yolo,
        settings.YOLO_MODEL_PATH,
    )
    await ModelRegistry.register("roof_detection", yolo_model)

    logger.info(
        "All models loaded",
        extra={"models": [m["key"] for m in ModelRegistry.list_models()]},
    )
