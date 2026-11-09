"""Vercel serverless entrypoint: serves the FastAPI backend under /api.

Locally and in Docker the API lives at the root and nginx / Vite strip the /api prefix. On
Vercel there is no proxy in front, so the app is mounted under /api here instead and the
frontend calls the same /api/... URLs everywhere.
"""

import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fastapi import FastAPI, Request  # noqa: E402

from app.main import app as backend  # noqa: E402

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", backend)


@app.middleware("http")
async def drop_rewrite_param(request: Request, call_next):
    # Vercel's rewrite (/api/:path* -> /api/index) appends the match as ?path=..., which the
    # API's strict query validation would reject. No endpoint has a `path` parameter.
    pairs = parse_qsl(request.scope["query_string"].decode(), keep_blank_values=True)
    request.scope["query_string"] = urlencode([(k, v) for k, v in pairs if k != "path"]).encode()
    return await call_next(request)
