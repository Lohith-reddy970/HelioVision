"""
tests/conftest.py
──────────────────
Pytest fixtures for testing the HelioVision FastAPI application.
"""

import asyncio
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app


@pytest.fixture(scope="session")
def event_loop():
    """Single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def app():
    """Create a fresh FastAPI app instance for testing."""
    return create_app()


@pytest.fixture(scope="session")
async def client(app):
    """Async HTTP client bound to the test app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"X-API-Key": "dev-insecure-key-do-not-use-in-production"},
    ) as ac:
        yield ac
