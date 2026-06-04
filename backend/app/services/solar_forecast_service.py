"""
app/services/solar_forecast_service.py
───────────────────────────────────────
Business logic for solar energy generation forecasting.

Responsibilities:
  - Feature engineering (map request → model input array)
  - Model inference via ModelRegistry
  - Confidence interval estimation (using RF tree variance)
  - Result packaging into response schema
"""

import asyncio
import math
from typing import Any

import numpy as np

from app.core.exceptions import PredictionException
from app.core.logging import get_logger
from app.ml.model_registry import ModelRegistry
from app.schemas.solar_forecast import SolarForecastRequest, SolarForecastResponse

logger = get_logger(__name__)

# CO₂ emission factor for grid electricity (kg CO₂ / kWh) — global average
_GRID_CO2_FACTOR = 0.475


def _build_feature_vector(req: SolarForecastRequest) -> np.ndarray:
    """
    Convert the validated request into the numpy array expected by the RF model.
    Expected features: ['AMBIENT_TEMPERATURE', 'MODULE_TEMPERATURE', 'IRRADIATION', 'hour', 'day', 'month']
    """
    module_temp = req.temperature_celsius + (req.ghi / 800.0) * 20.0
    day_of_month = (req.day_of_year % 31)
    if day_of_month == 0: day_of_month = 1

    return np.array(
        [[
            req.temperature_celsius,      # AMBIENT_TEMPERATURE
            module_temp,                  # MODULE_TEMPERATURE
            req.ghi,                      # IRRADIATION
            req.hour,                     # hour
            day_of_month,                 # day
            req.month,                    # month
        ]],
        dtype=np.float32,
    )


def _estimate_confidence_interval(
    rf_model: Any,
    X: np.ndarray,
    base_prediction: float,
    capacity: float,
) -> tuple[float, float]:
    """
    Compute an approximate 95% confidence interval by collecting predictions
    from each individual tree in the Random Forest ensemble.

    Falls back to ±10% when the model is a stub (None).
    """
    if rf_model is None or not hasattr(rf_model, 'estimators_'):
        margin = base_prediction * 0.10
        return max(0.0, base_prediction - margin), base_prediction + margin

    # Gather per-tree predictions (converted to kWh and scaled by capacity)
    tree_preds = np.array([
        (tree.predict(X)[0] * capacity) / 1000.0 for tree in rf_model.estimators_
    ])
    std = float(np.std(tree_preds))
    # 95% CI ~ mean ± 1.96 * σ
    lower = max(0.0, base_prediction - 1.96 * std)
    upper = base_prediction + 1.96 * std
    return lower, upper


def _irradiance_efficiency_factor(ghi: float, tilt_deg: float, azimuth_deg: float) -> float:
    """
    Simple irradiance efficiency factor based on panel geometry vs. GHI.
    Returns a value in [0, 1].
    """
    max_theoretical_ghi = 1361.0  # W/m² — solar constant
    tilt_factor = math.cos(math.radians(tilt_deg))
    efficiency = min(1.0, (ghi / max_theoretical_ghi) * tilt_factor)
    return round(max(0.0, efficiency), 4)


def _run_inference(rf_model: Any, X: np.ndarray, capacity: float, efficiency: float) -> float:
    """Synchronous inference — will be offloaded to executor."""
    if rf_model is None:
        # Stub: deterministic dummy prediction for development
        return float(np.clip(X[0, 2] * capacity * efficiency / 1000, 0, 999))
    predicted = rf_model.predict(X)[0]
    return max(0.0, (float(predicted) * capacity) / 1000.0)


class SolarForecastService:
    """
    Solar forecasting service.  All public methods are async; CPU-heavy
    inference is run in a thread pool executor to avoid blocking the event loop.
    """

    async def predict(self, request: SolarForecastRequest) -> SolarForecastResponse:
        """
        Run the Random Forest forecast model and return a structured response.

        Steps:
          1. Build feature vector
          2. Run inference in thread pool
          3. Compute confidence interval
          4. Calculate irradiance efficiency factor
          5. Return structured response
        """
        # Use .get() to tolerate stub (None) models in development;
        # real deployments will have actual model files loaded.
        rf_model = ModelRegistry._store.get("solar_forecast")

        X = _build_feature_vector(request)

        loop = asyncio.get_event_loop()

        # Offload CPU-bound inference to thread pool
        predicted_kwh = await loop.run_in_executor(None, _run_inference, rf_model, X, request.panel_capacity_kw, request.panel_efficiency_pct / 100.0)

        # Enforce Generation Yield Constraints (Physics Bounding)
        # Annual Generation (kWh) = System Size (kWp) * Specific Yield (kWh/kWp)
        specific_yield = predicted_kwh / request.panel_capacity_kw if request.panel_capacity_kw > 0 else 0
        
        # Limit specific yield to realistic bounds (e.g., 800 - 1800 kWh/kWp depending on GHI)
        # A simple linear scale based on GHI (0 to 1200 W/m2 typical range)
        min_yield = max(800.0, 800.0 + (request.ghi / 1200.0) * 400.0)
        max_yield = min(1800.0, 1200.0 + (request.ghi / 1200.0) * 600.0)
        
        specific_yield = max(min_yield, min(max_yield, specific_yield))
        predicted_kwh = request.panel_capacity_kw * specific_yield

        # Confidence interval (also potentially CPU-heavy for large forests)
        lower, upper = await loop.run_in_executor(
            None, _estimate_confidence_interval, rf_model, X, predicted_kwh, request.panel_capacity_kw
        )

        irr_factor = _irradiance_efficiency_factor(
            ghi=request.ghi,
            tilt_deg=request.panel_tilt_degrees,
            azimuth_deg=request.panel_azimuth_degrees,
        )

        # Advisory notes
        notes: str | None = None
        if request.cloud_cover_pct > 80:
            notes = "High cloud cover detected — generation may be significantly reduced."
        elif request.ghi < 100:
            notes = "Very low irradiance — output may be negligible."

        logger.info(
            "Solar forecast completed",
            extra={
                "predicted_kwh": predicted_kwh,
                "panel_capacity_kw": request.panel_capacity_kw,
                "ghi": request.ghi,
            },
        )

        return SolarForecastResponse(
            predicted_kwh=round(predicted_kwh, 4),
            confidence_interval_lower=round(lower, 4),
            confidence_interval_upper=round(upper, 4),
            irradiance_efficiency_factor=irr_factor,
            notes=notes,
        )


# Singleton instance shared across requests (no state)
solar_forecast_service = SolarForecastService()
