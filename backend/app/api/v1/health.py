"""
app/api/v1/health.py
─────────────────────
Health check and system info endpoints — enhanced for enterprise.

Endpoints:
  GET /api/v1/health           – Liveness probe (fast, no dependencies)
  GET /api/v1/health/ready     – Readiness probe (checks all systems)
  GET /api/v1/health/detail    – Full diagnostic report (db, models, disk, memory)
  GET /api/v1/health/models    – Model registry status
"""

from fastapi import APIRouter, Request, Response, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.health_service import CheckStatus, run_all_health_checks
from app.core.rate_limit import LIMIT_HEALTH, limiter
from app.ml.model_registry import ModelRegistry
from app.schemas.common import HealthResponse, SuccessResponse
from app.utils.response_utils import ok

router = APIRouter(
    prefix="/health",
    tags=["Health"],
)


@router.get(
    "",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Liveness Probe",
    description=(
        "Fast liveness check — returns 200 if the process is alive. "
        "Does NOT check database or model status. Use /ready for that."
    ),
)
@limiter.limit(LIMIT_HEALTH)
async def liveness(request: Request) -> HealthResponse:
    """Kubernetes liveness probe. Returns 200 as long as the process is running."""
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        models_loaded=ModelRegistry.list_models(),
    )


@router.get(
    "/ready",
    status_code=status.HTTP_200_OK,
    summary="Readiness Probe",
    description=(
        "Readiness check — verifies all critical systems are operational. "
        "Returns 503 if any required model is missing or disk is full."
    ),
)
@limiter.limit(LIMIT_HEALTH)
async def readiness(request: Request) -> JSONResponse:
    """Kubernetes readiness probe. Used by load balancers to route traffic."""
    report = await run_all_health_checks(
        include_db=False
    )
    overall = report["overall_status"]

    if overall == CheckStatus.FAIL:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "checks": report["checks"]},
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "ready", "checks": report["checks"]},
    )


@router.get(
    "/detail",
    response_model=SuccessResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Detailed Health Report",
    description=(
        "Full diagnostic report with per-component health status, latency, "
        "and error details. Suitable for ops dashboards and alerting."
    ),
)
@limiter.limit(LIMIT_HEALTH)
async def health_detail(request: Request) -> SuccessResponse[dict]:
    """
    Returns detailed health including:
    - Database connectivity + latency (optional — ok/degraded if absent, never blocks)
    - ML model registry (loaded vs stub)
    - Disk space on upload directory
    - Process memory usage (if psutil is installed)
    """
    report = await run_all_health_checks(
        include_db=False
    )
    return ok(message="Health detail report", data=report)


@router.get(
    "/models",
    response_model=SuccessResponse[list],
    status_code=status.HTTP_200_OK,
    summary="Model Registry Status",
    description="Returns detailed status of all registered ML models.",
)
@limiter.limit(LIMIT_HEALTH)
async def model_status(request: Request) -> SuccessResponse[list]:
    """Returns current model registry — key, type, and whether it's a stub."""
    models = []
    for entry in ModelRegistry.list_models():
        key = entry["key"]
        obj = ModelRegistry._store.get(key)
        models.append({
            "key": key,
            "type": entry["type"],
            "is_stub": obj is None,
            "is_loaded": ModelRegistry.is_loaded(key),
        })
    return ok(message="Model registry status", data=models)
