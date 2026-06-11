"""
app/core/security.py
─────────────────────
API key authentication dependency.
Extend with JWT / OAuth2 as the platform grows.
"""

import os
import json
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Load environment variables from .env file (local dev only — no-op in production)
load_dotenv()

# Initialize Firebase Admin — supports two modes:
#   1. FIREBASE_SERVICE_ACCOUNT_JSON  – JSON string (Railway / any cloud env)
#   2. GOOGLE_APPLICATION_CREDENTIALS – file path  (local development)
if not firebase_admin._apps:
    try:
        service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        if service_account_json:
            # Production: decode the JSON string directly
            cred = credentials.Certificate(json.loads(service_account_json))
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_JSON.")
        else:
            # Local dev: fall back to GOOGLE_APPLICATION_CREDENTIALS file path
            firebase_admin.initialize_app()
            logger.info("Firebase Admin initialized from GOOGLE_APPLICATION_CREDENTIALS file.")
    except Exception as e:
        logger.error(f"Error initializing Firebase Admin: {e}")


API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)
firebase_security = HTTPBearer(auto_error=False)


async def get_api_key(api_key: str | None = Security(API_KEY_HEADER)) -> str:
    """
    Dependency that validates the X-API-Key header.

    Skip validation in development mode to ease local testing.
    In production the SECRET_KEY env var must match the header value.
    """
    if settings.ENVIRONMENT == "development":
        return "dev-bypass"

    if not api_key or api_key != settings.SECRET_KEY:
        logger.warning("Unauthorised API access attempt")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    return api_key

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(firebase_security)):
    """
    Dependency to verify Firebase ID tokens.
    Returns the decoded token dictionary if valid.

    Skip validation in development mode to ease local testing.
    """
    if settings.ENVIRONMENT == "development":
        return {"uid": "dev-user", "email": "dev@localhost"}

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.error(f"Error verifying Firebase ID token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
