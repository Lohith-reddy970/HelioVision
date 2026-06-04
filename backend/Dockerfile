# ─────────────────────────────────────────────────────────────────────────────
# HelioVision – Multi-stage Production Dockerfile
# ─────────────────────────────────────────────────────────────────────────────
#
# Stages:
#   1. builder  – install deps into /install (no dev tools in final image)
#   2. runtime  – minimal Python image, copy only artefacts from builder
#
# Build:
#   docker build -t heliovision-backend:latest .
#
# Run:
#   docker run -p 8000:8000 --env-file .env heliovision-backend:latest
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: dependency builder ───────────────────────────────────────────────
FROM python:3.11-slim AS builder

# System packages needed to compile Python extensions (Pillow, opencv)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libffi-dev \
        libssl-dev \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy only requirements first (improves layer cache)
COPY requirements.txt .

# Install into a dedicated prefix — will be copied to runtime stage
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL maintainer="HelioVision Platform Team <support@heliovision.dev>"
LABEL org.opencontainers.image.title="HelioVision Backend"
LABEL org.opencontainers.image.description="FastAPI backend for HelioVision Solar AI"
LABEL org.opencontainers.image.version="1.0.0"

# Runtime system libraries (no compilers, no postgres client)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for security
RUN groupadd -r solarai && useradd -r -g solarai -m solarai

WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Copy application source
COPY --chown=solarai:solarai app/ ./app/

# Copy ML model files (bundled in image — ~82 MB)
# Prerequisite: run this from project root before docker build:
#   mkdir backend/models
#   copy trained-models/*.pkl backend/models/
#   copy trained-models/*.pt  backend/models/
COPY --chown=solarai:solarai models/ ./models/

# Create directories owned by the app user
RUN mkdir -p uploads logs && chown -R solarai:solarai uploads logs

# Switch to non-root user
USER solarai

# Expose API port
EXPOSE 8000

# Health check — uses the liveness endpoint
# start-period=120s gives YOLO enough time to load before health checks begin
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Default environment
ENV ENVIRONMENT=production \
    LOG_FORMAT=json \
    LOG_LEVEL=INFO \
    WORKERS=2

CMD uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers ${WORKERS} \
        --access-log \
        --log-level warning \
        --no-use-colors
