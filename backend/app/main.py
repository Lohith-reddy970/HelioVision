"""
app/main.py
────────────
FastAPI application factory and lifespan manager.

Enterprise features added:
  - slowapi rate limiting (per-IP, per-endpoint tiers)
  - Security headers middleware (OWASP recommendations)
  - Request timeout middleware (configurable)
  - Multi-version API routing (/api/v1, /api/v2)
  - API deprecation header on v1 responses
  - Trusted host validation
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.router import api_v1_router
from app.api.v2.router import api_v2_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import get_logger, setup_logging
from app.core.middleware import (
    CorrelationIDMiddleware,
    RequestLoggingMiddleware,
    RequestTimeoutMiddleware,
    SecurityHeadersMiddleware,
)
from app.core.rate_limit import limiter
from app.ml.model_registry import load_all_models

logger = get_logger(__name__)


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown lifecycle handler."""
    setup_logging()
    logger.info(
        "Starting %s v%s [%s]",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.ENVIRONMENT,
    )

    # Load ML models into the registry
    await load_all_models()

    logger.info("Application startup complete — listening for requests")
    yield

    # Shutdown
    logger.info("Shutting down application...")
    logger.info("Shutdown complete")


# ── Application factory ────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application.

    Designed as a factory (not module-level) to support:
      - testing (app.dependency_overrides)
      - multiple workers without shared state issues
    """
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=settings.APP_DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        contact={
            "name": "HelioVision Platform Team",
            "url": "https://github.com/Lohith1234567/Solar-AI-platform",
            "email": "support@heliovision.dev",
        },
        license_info={"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
        openapi_tags=[
            {"name": "Health", "description": "Liveness, readiness, and detailed system health"},
            {"name": "Solar Forecasting", "description": "Random Forest solar generation prediction"},
            {"name": "Savings Prediction", "description": "Financial ROI and savings analysis"},
            {"name": "Roof Detection", "description": "YOLOv8 aerial image roof analysis"},
        ],
    )

    # ── Attach rate limiter to app state ───────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── Middleware stack ────────────────────────────────────────────────────────
    # IMPORTANT: In Starlette/FastAPI the middleware registered LAST runs FIRST
    # on incoming requests (outermost). We register CORSMiddleware LAST so it
    # intercepts OPTIONS preflight requests before any other middleware can
    # reject them (e.g. rate-limiter, auth, security headers).
    #
    # Execution order for an incoming request:
    #   CORS → GZip → TrustedHost → RateLimiter → SecurityHeaders →
    #   Timeout → CorrelationID → RequestLogging → route handler

    # 1. Request logging (innermost — sees final path + status)
    app.add_middleware(RequestLoggingMiddleware)

    # 2. Correlation ID / Request ID tracing
    app.add_middleware(CorrelationIDMiddleware)

    # 3. Request timeout (60 s default; override per-request for heavy ML)
    app.add_middleware(
        RequestTimeoutMiddleware,
        timeout_seconds=settings.REQUEST_TIMEOUT_SECONDS,
    )

    # 4. Security headers
    app.add_middleware(SecurityHeadersMiddleware)

    # 5. Rate limiting
    app.add_middleware(SlowAPIMiddleware)

    # 6. Trusted hosts (prevent Host header injection)
    if settings.ENVIRONMENT == "production":
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.ALLOWED_HOSTS_STR.split(","),
        )

    # 7. GZip — compress large JSON responses
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # 8. CORS — registered LAST so it runs FIRST on incoming requests.
    #    This ensures OPTIONS preflight requests are handled immediately
    #    and never reach the rate limiter or auth middleware.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Correlation-ID", "X-Request-ID", "X-Response-Time-Ms",
                        "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    )

    # ── Exception handlers ─────────────────────────────────────────────────────
    register_exception_handlers(app)

    # ── API version routers ────────────────────────────────────────────────────
    app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)
    app.include_router(api_v2_router, prefix=settings.API_V2_PREFIX)

    # ── Root endpoint ──────────────────────────────────────────────────────────
    @app.get("/", include_in_schema=False)
    async def root(request: Request):
        return {
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "docs": "/docs",
            "api_versions": {
                "v1": {
                    "prefix": settings.API_V1_PREFIX,
                    "status": "stable",
                    "docs": "/docs",
                },
                "v2": {
                    "prefix": settings.API_V2_PREFIX,
                    "status": "beta",
                },
            },
            "health": f"{settings.API_V1_PREFIX}/health",
        }

    return app


# Module-level app instance consumed by uvicorn
app = create_app()
