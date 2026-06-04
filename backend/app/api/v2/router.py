"""
app/api/v2/router.py
─────────────────────
API v2 router — enhanced endpoints with richer response schemas.

v2 Philosophy vs v1:
  - Batch prediction support (send multiple inputs in one call)
  - Richer response envelopes (metadata, model lineage, confidence tiers)
  - Deprecation warning header on v1 for migrating clients
  - All v1 features still available; v2 extends, not replaces

Current v2 endpoints:
  GET  /api/v2/info          – API version and capability info
  POST /api/v2/solar/batch   – Batch solar forecast (up to 100 inputs)
"""

from fastapi import APIRouter, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.dependencies import ApiKey, ForecastSvc
from app.core.rate_limit import LIMIT_ML_INFERENCE, limiter
from app.schemas.common import SuccessResponse
from app.schemas.solar_forecast import SolarForecastRequest, SolarForecastResponse
from app.utils.response_utils import ok

api_v2_router = APIRouter()

# ── v2 info router ─────────────────────────────────────────────────────────────
info_router = APIRouter(prefix="/info", tags=["API v2"])


@info_router.get(
    "",
    response_model=SuccessResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="API v2 Information",
    description="Returns capability info for the v2 API.",
)
async def api_v2_info() -> SuccessResponse[dict]:
    return ok(
        message="HelioVision API v2 — beta",
        data={
            "version": "2.0.0-beta",
            "status": "beta",
            "new_in_v2": [
                "Batch prediction endpoint (POST /api/v2/solar/batch)",
                "Richer response envelopes with model lineage",
                "Per-endpoint rate limit headers",
                "Confidence tier classification",
            ],
            "migration_guide": (
                f"v1 endpoints at {settings.API_V1_PREFIX} remain fully supported. "
                "Migrate to v2 at your own pace."
            ),
        },
    )


# ── v2 solar router ────────────────────────────────────────────────────────────
solar_v2_router = APIRouter(prefix="/solar", tags=["Solar Forecasting"])


class BatchForecastRequest(SolarForecastRequest.__class__):
    pass  # placeholder; in practice define a list wrapper


@solar_v2_router.post(
    "/batch",
    response_model=SuccessResponse[list],
    status_code=status.HTTP_200_OK,
    summary="Batch Solar Forecast (v2)",
    description=(
        "Run solar generation predictions for up to 20 input configurations "
        "in a single request. Each item follows the same schema as v1 /solar/forecast."
    ),
)
@limiter.limit(LIMIT_ML_INFERENCE)
async def batch_solar_forecast(
    request: Request,
    inputs: list[SolarForecastRequest],
    api_key: ApiKey,
    service: ForecastSvc,
) -> SuccessResponse[list]:
    """
    Batch prediction — runs all inputs concurrently in the thread pool.
    Returns a list of predictions in the same order as inputs.
    """
    import asyncio
    from app.services.solar_forecast_service import SolarForecastService

    if len(inputs) > 20:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch size cannot exceed 20 items.",
        )

    results: list[SolarForecastResponse] = await asyncio.gather(
        *[service.predict(inp) for inp in inputs]
    )

    return ok(
        message=f"Batch forecast completed for {len(results)} inputs",
        data=[r.model_dump() for r in results],
    )


# ── Assemble v2 router ─────────────────────────────────────────────────────────
api_v2_router.include_router(info_router)
api_v2_router.include_router(solar_v2_router)
