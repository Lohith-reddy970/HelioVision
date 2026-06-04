"""
app/api/v1/savings.py
──────────────────────
Savings Prediction API — with DI, rate limiting, and request validation.

Endpoints:
  POST /api/v1/savings/predict    – full savings prediction (rate: 30/min)
  GET  /api/v1/savings/quick      – quick estimate (rate: 120/min)
"""

from fastapi import APIRouter, Query, Request, Response, status

from app.core.dependencies import ApiKey, SavingsSvc
from app.core.rate_limit import LIMIT_DEFAULT, LIMIT_ML_INFERENCE, limiter
from app.schemas.common import SuccessResponse
from app.schemas.savings import SavingsPredictionRequest, SavingsPredictionResponse
from app.utils.response_utils import ok

router = APIRouter(
    prefix="/savings",
    tags=["Savings Prediction"],
)


@router.post(
    "/predict",
    response_model=SuccessResponse[SavingsPredictionResponse],
    status_code=status.HTTP_200_OK,
    summary="Predict Solar Installation Savings",
    description=(
        "Predict the full financial impact of a solar installation: "
        "annual savings, lifetime NPV, payback period, ROI, monthly breakdown, "
        "and CO2 offset. Uses the ML savings model enriched with a "
        "deterministic financial calculator. "
        "**Rate limit: 30 requests/minute per IP.**"
    ),
)
@limiter.limit(LIMIT_ML_INFERENCE)
async def predict_savings(
    request: Request,
    body: SavingsPredictionRequest,
    api_key: ApiKey,
    service: SavingsSvc,
) -> SuccessResponse[SavingsPredictionResponse]:
    """
    **Input:** System size, energy tariffs, consumption profile, installation cost.

    **Output:** Year-1 savings, lifetime savings, NPV, ROI, monthly breakdown,
    year-by-year trajectory, CO2 offset.
    """
    result = await service.predict(body)
    return ok(message="Savings prediction completed successfully", data=result)


@router.get(
    "/quick",
    response_model=SuccessResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Quick Savings Estimate",
    description=(
        "Lightweight rule-of-thumb savings estimate. "
        "Returns a summary in milliseconds. "
        "Use POST /savings/predict for the full ML-powered analysis."
    ),
)
@limiter.limit(LIMIT_DEFAULT)
async def quick_savings_estimate(
    request: Request,
    api_key: ApiKey,
    panel_capacity_kw: float = Query(..., gt=0, description="System size in kW"),
    electricity_rate_per_kwh: float = Query(..., gt=0, description="Tariff in currency/kWh"),
    annual_consumption_kwh: float = Query(..., gt=0, description="Annual consumption in kWh"),
    installation_cost: float = Query(..., gt=0, description="Total installation cost"),
) -> SuccessResponse[dict]:
    """Fast savings estimate using rule-of-thumb (1 kWp ~ 1150 kWh/year)."""
    annual_generation = panel_capacity_kw * 1150
    self_consumption = min(annual_generation * 0.7, annual_consumption_kwh)
    annual_savings = self_consumption * electricity_rate_per_kwh
    payback = installation_cost / annual_savings if annual_savings > 0 else -1.0

    return ok(
        message="Quick estimate calculated",
        data={
            "estimated_annual_savings": round(annual_savings, 2),
            "estimated_annual_generation_kwh": round(annual_generation, 2),
            "estimated_payback_years": round(payback, 1),
            "note": "Use POST /savings/predict for the full ML-powered analysis.",
        },
    )
