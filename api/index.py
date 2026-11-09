"""Vercel serverless entrypoint: serves the FastAPI backend under /api.

Locally and in Docker the API lives at the root and nginx / Vite strip the /api prefix. On
Vercel there is no proxy in front, so the app is mounted under /api here instead and the
frontend calls the same /api/... URLs everywhere.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fastapi import FastAPI  # noqa: E402

from app.main import app as backend  # noqa: E402

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", backend)
