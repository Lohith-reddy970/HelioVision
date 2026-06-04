"""
app/core/database.py
─────────────────────
Optional database support. The application runs fully without a database.
If DATABASE_URL is set to a reachable database, logging/analytics will work.
If not set or unreachable, all core AI functionality continues normally.

The get_db() dependency yields None when no DB is configured — routes must
never inject DBSession directly (they don't; this module is kept for
future opt-in analytics only).
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Optional SQLAlchemy support ────────────────────────────────────────────────
# Imports are lazy — missing asyncpg/sqlalchemy won't crash the app.

_engine: Any = None
_AsyncSessionFactory: Any = None
Base: Any = None

try:
    from app.core.config import settings

    # Only attempt DB connection if a real URL is configured (not empty / placeholder)
    _db_url = str(settings.DATABASE_URL)
    _db_enabled = bool(
        _db_url
        and _db_url != "none"
        and "REPLACE" not in _db_url
    )

    if _db_enabled:
        from sqlalchemy.ext.asyncio import (
            AsyncSession,
            async_sessionmaker,
            create_async_engine,
        )
        from sqlalchemy.orm import DeclarativeBase

        _engine_kwargs: dict[str, Any] = {
            "echo": settings.DATABASE_ECHO,
            "pool_pre_ping": True,
        }
        if "sqlite" not in _db_url:
            _engine_kwargs["pool_size"] = settings.DATABASE_POOL_SIZE
            _engine_kwargs["max_overflow"] = settings.DATABASE_MAX_OVERFLOW
            _engine_kwargs["pool_recycle"] = 1800

        _engine = create_async_engine(_db_url, **_engine_kwargs)

        _AsyncSessionFactory = async_sessionmaker(
            bind=_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
            autocommit=False,
        )

        class Base(DeclarativeBase):  # type: ignore[no-redef]
            """Base class for optional ORM logging models."""
            pass

        logger.info("Database configured", extra={"url_scheme": _db_url.split(":")[0]})
    else:
        logger.info("Database not configured — running in stateless mode")

        class Base:  # type: ignore[no-redef]
            """Stub Base when database is not configured."""
            pass

except Exception as exc:  # pragma: no cover
    logger.warning("Database setup skipped: %s", exc)


# Convenience aliases for legacy imports
engine = _engine
AsyncSessionFactory = _AsyncSessionFactory


# ── FastAPI dependency (no-op stub when DB is absent) ─────────────────────────
async def get_db() -> AsyncGenerator[Any, None]:
    """
    Yield a database session when DB is configured, otherwise yield None.
    Core AI routes do NOT use this — it exists for optional analytics only.
    """
    if _AsyncSessionFactory is None:
        yield None
        return

    from sqlalchemy.ext.asyncio import AsyncSession

    async with _AsyncSessionFactory() as session:  # type: ignore[misc]
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Startup / shutdown helpers ─────────────────────────────────────────────────
async def init_db() -> None:
    """Create ORM tables if DB is configured. No-op otherwise."""
    if _engine is None or Base is None:
        logger.debug("init_db: no database configured, skipping")
        return
    try:
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialised")
    except Exception as exc:
        logger.warning("init_db failed (non-fatal): %s", exc)


async def close_db() -> None:
    """Dispose connection pool on shutdown. No-op when DB absent."""
    if _engine is None:
        return
    try:
        await _engine.dispose()
        logger.info("Database connection pool disposed")
    except Exception as exc:  # pragma: no cover
        logger.warning("close_db error (non-fatal): %s", exc)
