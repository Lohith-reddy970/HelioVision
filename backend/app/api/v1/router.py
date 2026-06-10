"""
app/api/v1/router.py
─────────────────────
Aggregates all v1 sub-routers into a single APIRouter.
Imported once in main.py via: app.include_router(api_v1_router)
"""

from fastapi import APIRouter, Depends

from app.api.v1 import health, roof_detection, savings, solar_forecast
from app.core.security import get_current_user

api_v1_router = APIRouter()

# ── Register all sub-routers ───────────────────────────────────────────────────
api_v1_router.include_router(health.router)
api_v1_router.include_router(solar_forecast.router, dependencies=[Depends(get_current_user)])
api_v1_router.include_router(savings.router, dependencies=[Depends(get_current_user)])
api_v1_router.include_router(roof_detection.router, dependencies=[Depends(get_current_user)])
