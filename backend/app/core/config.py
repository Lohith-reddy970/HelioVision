"""
app/core/config.py
──────────────────
Centralised application settings loaded from environment variables (or .env file).
Uses pydantic-settings so every field is type-safe and validated at startup.
"""

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Application ────────────────────────────────────────────────────────────
    APP_NAME: str = "HelioVision Optimization Platform"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = (
        "Production-ready API for AI-powered solar energy forecasting, "
        "savings prediction, and roof detection."
    )
    DEBUG: bool = False
    ENVIRONMENT: str = "production"  # development | staging | production

    # ── API ────────────────────────────────────────────────────────────────────
    API_V1_PREFIX: str = "/api/v1"
    API_V2_PREFIX: str = "/api/v2"
    SECRET_KEY: str = "CHANGE_ME_TO_A_STRONG_RANDOM_SECRET"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REQUEST_TIMEOUT_SECONDS: float = 60.0  # HTTP 504 after this many seconds

    # ── CORS ───────────────────────────────────────────────────────────────────
    # Include all known frontend origins. Override via ALLOWED_ORIGINS_STR env
    # variable on Railway / production. Use "*" to allow all origins (dev only).
    ALLOWED_ORIGINS_STR: str = (
        "http://localhost:3000,"
        "http://localhost:8080,"
        "http://127.0.0.1:3000,"
        "http://127.0.0.1:5500,"
        "https://solar-ai-platform.vercel.app,"
        "https://heliovision.vercel.app,"
        "https://helio-vision.vercel.app"
    )

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        """Parse the comma-separated origins string into a list.

        Special case: if the string is exactly '*', return ['*'] to allow
        all origins (useful for initial deployment debugging).
        """
        raw = self.ALLOWED_ORIGINS_STR.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    # ── Trusted hosts (production) ─────────────────────────────────────────────
    # Comma-separated: ALLOWED_HOSTS_STR=api.solarai.dev,*.solarai.dev
    ALLOWED_HOSTS_STR: str = "*"  # '*' = allow all (restrict in production)

    # ── Rate limiting ──────────────────────────────────────────────────────────
    RATE_LIMIT_DEFAULT: str = "120/minute"
    RATE_LIMIT_ML: str = "30/minute"
    RATE_LIMIT_UPLOAD: str = "10/minute"

    # ── Redis (not used — in-memory rate limiting is active) ────────────────────
    # Set REDIS_URL in .env to enable Redis-backed distributed rate limiting.
    REDIS_URL: str = ""  # leave empty to use in-memory (default, no Redis needed)

    # ── Database (fully optional) ─────────────────────────────────────────────
    # Leave DATABASE_URL empty (default) to run in stateless / no-DB mode.
    # Core AI functionality (roof detection, solar forecast, savings) does NOT
    # require a database. Set DATABASE_URL only if you want analytics logging.
    DATABASE_URL: str = ""  # e.g. sqlite+aiosqlite:///solar_db.sqlite
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_ECHO: bool = False  # set True to log SQL queries (dev only)

    # ── File upload ────────────────────────────────────────────────────────────
    UPLOAD_DIR: Path = Path("uploads")
    MAX_UPLOAD_SIZE_MB: int = 10  # megabytes
    # Comma-separated in .env: ALLOWED_IMAGE_TYPES_STR=image/jpeg,image/png
    ALLOWED_IMAGE_TYPES_STR: str = "image/jpeg,image/png,image/webp"

    @property
    def ALLOWED_IMAGE_TYPES(self) -> List[str]:
        return [t.strip() for t in self.ALLOWED_IMAGE_TYPES_STR.split(",") if t.strip()]

    # ── ML Model paths ─────────────────────────────────────────────────────────
    # Resolved relative to the repo root (four levels above this file).
    MODELS_BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent / "trained-models"
    SOLAR_FORECAST_MODEL_PATH: Path = MODELS_BASE_DIR / "solar_forecast_model.pkl"
    SAVINGS_MODEL_PATH: Path = MODELS_BASE_DIR / "savings_prediction_model.pkl"
    YOLO_MODEL_PATH: Path = MODELS_BASE_DIR / "prediction_yolo1.pt"

    # Solar engineering assumptions
    ROOF_METERS_PER_PIXEL: float = 0.1
    SOLAR_PANEL_AREA_M2: float = 2.4
    SOLAR_PANEL_WATTAGE_W: float = 550.0
    SOLAR_KWH_PER_KWP_PER_YEAR: float = 1150.0
    SOLAR_MAX_ROOF_COVERAGE_FACTOR: float = 0.85
    SOLAR_MAX_MODULE_POWER_DENSITY_KW_PER_M2: float = 0.23

    # ── Logging ────────────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # "json" | "text"
    LOG_FILE: Path = Path("logs/solar_api.log")

    # ── External services (future microservice expansion) ──────────────────────
    WEATHER_API_KEY: str = ""
    WEATHER_API_BASE_URL: str = "https://api.openweathermap.org/data/2.5"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()


# Convenience alias used throughout the codebase
settings = get_settings()
