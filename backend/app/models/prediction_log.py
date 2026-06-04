"""
app/models/prediction_log.py
─────────────────────────────
ORM models for optional DB logging — PredictionLog and RoofDetectionLog.

These models are NEVER required for core AI functionality.
They exist for future opt-in analytics/audit logging.
If the database is not configured, these classes are harmless stubs.
"""

try:
    from sqlalchemy import Float, Index, Integer, String, Text
    from sqlalchemy.orm import Mapped, mapped_column

    from app.core.database import Base
    from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

    if Base is not None and hasattr(Base, "metadata"):
        class PredictionLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
            """
            Optional: persists ML prediction calls for audit and retraining.
            Only written to when a database is configured.
            """

            __tablename__ = "prediction_logs"

            endpoint: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
            model_key: Mapped[str] = mapped_column(String(100), nullable=False)
            model_version: Mapped[str] = mapped_column(String(50), nullable=True)

            input_data: Mapped[str] = mapped_column(Text, nullable=False)
            output_data: Mapped[str] = mapped_column(Text, nullable=False)

            latency_ms: Mapped[float] = mapped_column(Float, nullable=True)
            status: Mapped[str] = mapped_column(String(20), default="success")
            error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

            correlation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
            client_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

            __table_args__ = (
                Index("ix_prediction_logs_endpoint_created", "endpoint", "created_at"),
            )

            def __repr__(self) -> str:
                return f"<PredictionLog id={self.id} endpoint={self.endpoint}>"

        class RoofDetectionLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
            """
            Optional: persists roof detection requests (image metadata only).
            Only written to when a database is configured.
            """

            __tablename__ = "roof_detection_logs"

            image_filename: Mapped[str] = mapped_column(String(255), nullable=False)
            image_size_bytes: Mapped[int] = mapped_column(Integer, nullable=True)
            image_width_px: Mapped[int] = mapped_column(Integer, nullable=True)
            image_height_px: Mapped[int] = mapped_column(Integer, nullable=True)

            segments_detected: Mapped[int] = mapped_column(Integer, default=0)
            total_usable_area_m2: Mapped[float] = mapped_column(Float, nullable=True)
            estimated_capacity_kw: Mapped[float] = mapped_column(Float, nullable=True)
            suitability: Mapped[str | None] = mapped_column(String(20), nullable=True)

            processing_time_ms: Mapped[float] = mapped_column(Float, nullable=True)
            correlation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

            def __repr__(self) -> str:
                return f"<RoofDetectionLog id={self.id} file={self.image_filename}>"

    else:
        # DB not configured — provide empty stubs
        class PredictionLog:  # type: ignore[no-redef]
            """Stub — database not configured."""
            pass

        class RoofDetectionLog:  # type: ignore[no-redef]
            """Stub — database not configured."""
            pass

except Exception:
    # Graceful fallback if SQLAlchemy is not installed
    class PredictionLog:  # type: ignore[no-redef]
        """Stub — SQLAlchemy not available."""
        pass

    class RoofDetectionLog:  # type: ignore[no-redef]
        """Stub — SQLAlchemy not available."""
        pass
