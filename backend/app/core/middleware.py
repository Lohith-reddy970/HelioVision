"""
app/core/middleware.py
───────────────────────
Application-level ASGI middleware stack.

Middleware stack (applied outer -> inner):
  1. SecurityHeadersMiddleware  – OWASP security headers on every response
  2. RequestTimeoutMiddleware   – kill requests exceeding configured timeout
  3. RequestLoggingMiddleware   – structured request/response logs with timing
  4. CorrelationIDMiddleware    – X-Correlation-ID tracing header
  5. CORSMiddleware             – handled by FastAPI directly (see main.py)
"""

import asyncio
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Context variables (available anywhere in the call stack) ───────────────────
# Correlation ID — injected by CorrelationIDMiddleware
correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")
# Request ID — unique per request even when correlation IDs are reused
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")


# ── 1. Security Headers ────────────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds OWASP-recommended security headers to every response.

    Headers added:
      - X-Content-Type-Options: nosniff
      - X-Frame-Options: DENY
      - X-XSS-Protection: 1; mode=block
      - Strict-Transport-Security (HTTPS only)
      - Referrer-Policy
      - Permissions-Policy (disables unused browser features)
      - Content-Security-Policy (basic; tighten for your frontend)
    """

    # ── CSP for API / application routes (tight production policy) ────────────
    _SECURITY_HEADERS: dict[str, str] = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:;"
        ),
    }

    # ── CSP for Swagger UI / ReDoc documentation routes ───────────────────────
    # FastAPI's built-in /docs and /redoc load assets from:
    #   - https://cdn.jsdelivr.net   (swagger-ui CSS + JS bundle)
    #   - https://fastapi.tiangolo.com (favicon)
    # These paths are opt-in; production API routes stay under the tight policy.
    _DOCS_CSP_HEADERS: dict[str, str] = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com;"
        ),
    }

    # Paths that serve FastAPI documentation UI assets
    _DOCS_PATHS: frozenset[str] = frozenset({"/docs", "/redoc", "/openapi.json"})

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        # Choose the appropriate CSP: relaxed for docs UI, tight for everything else
        headers = (
            self._DOCS_CSP_HEADERS
            if request.url.path in self._DOCS_PATHS
            else self._SECURITY_HEADERS
        )

        for header, value in headers.items():
            response.headers[header] = value

        # HSTS only over HTTPS
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        return response


# ── 2. Request Timeout ─────────────────────────────────────────────────────────

class RequestTimeoutMiddleware(BaseHTTPMiddleware):
    """
    Returns HTTP 504 if a request takes longer than `timeout_seconds`.

    ML inference endpoints can be slow — set a generous but finite timeout
    (e.g. 60 s) to prevent worker starvation from runaway requests.
    """

    def __init__(self, app: ASGIApp, timeout_seconds: float = 60.0) -> None:
        super().__init__(app)
        self.timeout = timeout_seconds

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        try:
            return await asyncio.wait_for(call_next(request), timeout=self.timeout)
        except asyncio.TimeoutError:
            logger.warning(
                "Request timeout after %.1f s",
                self.timeout,
                extra={
                    "path": request.url.path,
                    "method": request.method,
                    "timeout_seconds": self.timeout,
                    "correlation_id": correlation_id_ctx.get(),
                },
            )
            return JSONResponse(
                status_code=504,
                content={
                    "status": "error",
                    "code": 504,
                    "message": f"Request timed out after {self.timeout:.0f} seconds.",
                },
            )


# ── 3. Request Logging ─────────────────────────────────────────────────────────

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Logs every HTTP request and response with:
      - HTTP method & path
      - Query string
      - Response status code
      - Wall-clock latency in ms
      - Correlation ID + Request ID
      - Client IP (respects X-Forwarded-For)
    """

    # Paths to skip per-request logging (health probes, static files)
    _SKIP_PATHS: frozenset[str] = frozenset({
        "/health", "/metrics", "/favicon.ico", "/robots.txt",
    })

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        """Extract real client IP, respecting proxy forwarding headers."""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in self._SKIP_PATHS:
            return await call_next(request)

        start_time = time.perf_counter()
        req_id = request_id_ctx.get() or str(uuid.uuid4())
        client_ip = self._get_client_ip(request)

        response = await call_next(request)

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        log_level = "warning" if response.status_code >= 400 else "info"
        getattr(logger, log_level)(
            "HTTP %s %s -> %s (%.2f ms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={
                "method": request.method,
                "path": request.url.path,
                "query": str(request.url.query),
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "request_id": req_id,
                "correlation_id": correlation_id_ctx.get(),
                "client_ip": client_ip,
                "user_agent": request.headers.get("User-Agent", ""),
            },
        )

        response.headers["X-Response-Time-Ms"] = str(duration_ms)
        response.headers["X-Request-ID"] = req_id
        return response


# ── 4. Correlation ID ──────────────────────────────────────────────────────────

class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """
    Reads or generates a correlation ID for each request.

    - Reuses incoming X-Correlation-ID for distributed tracing.
    - Generates a new Request-ID (always unique per request).
    - Both are stored in context-vars for use by services and loggers.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        corr_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        req_id = str(uuid.uuid4())

        correlation_id_ctx.set(corr_id)
        request_id_ctx.set(req_id)

        response = await call_next(request)
        response.headers["X-Correlation-ID"] = corr_id
        return response
