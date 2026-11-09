import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient

ENTRY = Path(__file__).resolve().parents[2] / "api" / "index.py"


def test_vercel_entrypoint_serves_the_api_under_api_prefix() -> None:
    spec = importlib.util.spec_from_file_location("vercel_entry", ENTRY)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    client = TestClient(module.app)
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/health").status_code == 404  # only reachable through /api
    assert client.get("/api/patients").status_code == 401  # login is still enforced
