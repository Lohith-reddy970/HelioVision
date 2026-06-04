#!/usr/bin/env python3
"""
backend/run.py
───────────────
Convenience script to start the uvicorn development server.

Usage:
    python run.py                    # default settings from .env
    python run.py --port 8001        # custom port
    python run.py --reload           # hot-reload (dev)
"""

import argparse
import sys

import uvicorn

from app.core.config import settings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="HelioVision – Dev Server")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    parser.add_argument(
        "--reload",
        action="store_true",
        default=settings.DEBUG,
        help="Enable hot-reload (default: value of DEBUG env var)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes (use >1 only in production without --reload)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    print(f"\nStarting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"   Environment : {settings.ENVIRONMENT}")
    print(f"   Address     : http://{args.host}:{args.port}")
    print(f"   Swagger UI  : http://{args.host}:{args.port}/docs")
    print(f"   ReDoc       : http://{args.host}:{args.port}/redoc")
    print(f"   Hot-reload  : {args.reload}\n")

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=False,      # Our custom middleware handles request logging
    )
