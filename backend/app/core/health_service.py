"""
app/core/health_service.py
───────────────────────────
Detailed health check service used by the /health/ready endpoint.

Checks:
  1. Database connectivity (optional — skipped when DB not configured)
  2. ML model registry (all models loaded)
  3. Disk space (upload directory writable)
  4. Memory usage (warn if > 80%)

Each check is independent — a failing check downgrades the overall
status without aborting the others.

The database check is fully optional: when no DATABASE_URL is set the
readiness probe stays green and only reports "not_configured".
"""

import asyncio
import os
import shutil
import time
from enum import Enum
from typing import Any
from app.core.logging import get_logger
from app.ml.model_registry import ModelRegistry

logger = get_logger(__name__)


class CheckStatus(str, Enum):
    OK = "ok"
    DEGRADED = "degraded"
    FAIL = "fail"


class HealthCheckResult:
    """Result of a single health check."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.status: CheckStatus = CheckStatus.OK
        self.latency_ms: float = 0.0
        self.detail: dict[str, Any] = {}
        self.error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "status": self.status.value,
            "latency_ms": self.latency_ms,
        }
        if self.detail:
            result["detail"] = self.detail
        if self.error:
            result["error"] = self.error
        return result


# ── Individual checks ──────────────────────────────────────────────────────────

async def check_database() -> HealthCheckResult:
    """
    Ping the database with a SELECT 1.
    Returns status=ok when no DB is configured (stateless mode).
    """
    result = HealthCheckResult("database")
    start = time.perf_counter()

    # Import lazily — check if DB is actually configured
    try:
        from app.core.database import _engine, AsyncSessionFactory  # type: ignore[attr-defined]
    except Exception:
        _engine = None
        AsyncSessionFactory = None

    if _engine is None or AsyncSessionFactory is None:
        result.status = CheckStatus.OK
        result.latency_ms = 0.0
        result.detail = {"mode": "stateless", "note": "No database configured — running without DB"}
        return result

    try:
        from sqlalchemy import text
        async with AsyncSessionFactory() as session:
            await session.execute(text("SELECT 1"))
        result.latency_ms = round((time.perf_counter() - start) * 1000, 2)
        result.status = CheckStatus.OK
        result.detail = {"mode": "connected", "driver": "sqlalchemy"}
    except Exception as exc:
        result.latency_ms = round((time.perf_counter() - start) * 1000, 2)
        # DB is optional — a connection failure is DEGRADED, not FAIL
        result.status = CheckStatus.DEGRADED
        result.error = str(exc)
        logger.warning("Health check: database DEGRADED - %s", exc)
    return result


async def check_models() -> HealthCheckResult:
    """Verify all required ML models are registered."""
    result = HealthCheckResult("ml_models")
    required = ["solar_forecast", "savings", "roof_detection"]
    loaded = [k for k in required if ModelRegistry.is_loaded(k)]
    stubs = [k for k in loaded if ModelRegistry._store.get(k) is None]
    missing = [k for k in required if k not in loaded]

    result.detail = {
        "required": required,
        "loaded": loaded,
        "stubs": stubs,      # loaded but None (no model file)
        "missing": missing,
    }

    if missing:
        result.status = CheckStatus.FAIL
        result.error = f"Models not loaded: {missing}"
    elif stubs:
        # All models registered but some are stubs (dev mode)
        result.status = CheckStatus.DEGRADED
    else:
        result.status = CheckStatus.OK

    return result


async def check_disk() -> HealthCheckResult:
    """Check available disk space on the upload directory."""
    result = HealthCheckResult("disk")
    from app.core.config import settings
    try:
        usage = shutil.disk_usage(settings.UPLOAD_DIR)
        free_gb = usage.free / (1024 ** 3)
        total_gb = usage.total / (1024 ** 3)
        used_pct = (usage.used / usage.total) * 100

        result.detail = {
            "free_gb": round(free_gb, 2),
            "total_gb": round(total_gb, 2),
            "used_pct": round(used_pct, 1),
        }

        if used_pct > 95:
            result.status = CheckStatus.FAIL
            result.error = "Disk critically full (>95%)"
        elif used_pct > 85:
            result.status = CheckStatus.DEGRADED
        else:
            result.status = CheckStatus.OK
    except Exception as exc:
        result.status = CheckStatus.DEGRADED
        result.error = str(exc)
    return result


async def check_memory() -> HealthCheckResult:
    """Check process memory usage."""
    result = HealthCheckResult("memory")
    try:
        import psutil
        proc = psutil.Process(os.getpid())
        mem = proc.memory_info()
        mem_mb = mem.rss / (1024 ** 2)
        virtual_mem = psutil.virtual_memory()
        system_used_pct = virtual_mem.percent

        result.detail = {
            "process_rss_mb": round(mem_mb, 1),
            "system_used_pct": system_used_pct,
        }

        if system_used_pct > 90:
            result.status = CheckStatus.FAIL
        elif system_used_pct > 80:
            result.status = CheckStatus.DEGRADED
        else:
            result.status = CheckStatus.OK
    except ImportError:
        # psutil not installed — skip gracefully
        result.status = CheckStatus.OK
        result.detail = {"note": "psutil not installed, memory check skipped"}
    except Exception as exc:
        result.status = CheckStatus.DEGRADED
        result.error = str(exc)
    return result


# ── Aggregator ─────────────────────────────────────────────────────────────────

async def run_all_health_checks(
    include_db: bool = True,
) -> dict[str, Any]:
    """
    Run all health checks concurrently and return an aggregated report.

    The database check is always non-fatal:
      - Not configured → ok (stateless mode)
      - Configured but unreachable → degraded (not fail)

    This ensures a missing/unreachable DB never blocks readiness
    for core AI functionality.
    """
    checks_to_run = [check_models(), check_disk(), check_memory()]
    if include_db:
        checks_to_run.append(check_database())

    results: list[HealthCheckResult] = await asyncio.gather(*checks_to_run)

    checks_dict = {r.name: r.to_dict() for r in results}

    # Overall status: worst individual status wins
    # Note: database DEGRADED does not cause overall FAIL
    status_priority = [CheckStatus.FAIL, CheckStatus.DEGRADED, CheckStatus.OK]
    statuses = [r.status for r in results]
    overall = next(
        (s for s in status_priority if s in statuses),
        CheckStatus.OK,
    )

    return {
        "overall_status": overall.value,
        "checks": checks_dict,
    }
