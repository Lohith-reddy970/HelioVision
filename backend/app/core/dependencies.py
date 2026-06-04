"""
app/core/dependencies.py
─────────────────────────
Centralised FastAPI dependency injection container.

Every service and utility is exposed as a FastAPI Depends()-compatible
function.  Routes import from here — never from service modules directly.
This pattern allows:
  - easy mocking in tests (override_dependencies)
  - future swap of service implementations without touching route code
  - clear visibility of what each endpoint needs

Usage in a route:
    from app.core.dependencies import get_forecast_service

    @router.post("/forecast")
    async def forecast(
        request: SolarForecastRequest,
        service: SolarForecastService = Depends(get_forecast_service),
    ):
        return await service.predict(request)
"""

from typing import Annotated

from fastapi import Depends
from app.core.security import get_api_key
from app.services.roof_detection_service import RoofDetectionService
from app.services.savings_service import SavingsService
from app.services.solar_forecast_service import SolarForecastService


# ── Service providers ──────────────────────────────────────────────────────────
# Services are stateless singletons — safe to share across requests.
# Override these in tests: app.dependency_overrides[get_forecast_service] = mock_fn

def get_forecast_service() -> SolarForecastService:
    """Provide the solar forecast service instance."""
    from app.services.solar_forecast_service import solar_forecast_service
    return solar_forecast_service


def get_savings_service() -> SavingsService:
    """Provide the savings prediction service instance."""
    from app.services.savings_service import savings_service
    return savings_service


def get_roof_detection_service() -> RoofDetectionService:
    """Provide the roof detection service instance."""
    from app.services.roof_detection_service import roof_detection_service
    return roof_detection_service


# ── Type aliases (for clean route signatures) ──────────────────────────────────
ApiKey = Annotated[str, Depends(get_api_key)]
ForecastSvc = Annotated[SolarForecastService, Depends(get_forecast_service)]
SavingsSvc = Annotated[SavingsService, Depends(get_savings_service)]
RoofSvc = Annotated[RoofDetectionService, Depends(get_roof_detection_service)]
