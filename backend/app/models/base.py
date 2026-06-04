"""
app/models/base.py
───────────────────
Mixin classes shared across all ORM models.
These are only used when a database is configured (optional).
"""

import uuid
from datetime import datetime, timezone


try:
    from sqlalchemy import DateTime, String
    from sqlalchemy.orm import Mapped, mapped_column
    from app.core.database import Base

    _sqlalchemy_available = True

    class TimestampMixin:
        """Adds created_at / updated_at columns with automatic UTC timestamps."""

        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True),
            default=lambda: datetime.now(timezone.utc),
            nullable=False,
        )
        updated_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True),
            default=lambda: datetime.now(timezone.utc),
            onupdate=lambda: datetime.now(timezone.utc),
            nullable=False,
        )

    class UUIDPrimaryKeyMixin:
        """Adds a UUID primary key column."""

        id: Mapped[str] = mapped_column(
            String(36),
            primary_key=True,
            default=lambda: str(uuid.uuid4()),
        )

except Exception:
    # SQLAlchemy not available or DB not configured — provide stub mixins
    _sqlalchemy_available = False

    class TimestampMixin:  # type: ignore[no-redef]
        """Stub mixin when SQLAlchemy is unavailable."""
        pass

    class UUIDPrimaryKeyMixin:  # type: ignore[no-redef]
        """Stub mixin when SQLAlchemy is unavailable."""
        pass

    class Base:  # type: ignore[no-redef]
        """Stub Base when SQLAlchemy is unavailable."""
        pass
