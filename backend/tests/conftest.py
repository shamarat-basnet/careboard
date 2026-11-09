"""Test fixtures.

Tests run against in-memory SQLite by default so they need no external services. Set
TEST_DATABASE_URL (as CI does) to run the same suite against a real PostgreSQL instance.
"""

import os
from collections.abc import Iterator
from datetime import date, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user, get_narrator
from app.db.session import get_db
from app.main import app
from app.models import Base
from app.services.summary import TemplateNarrator

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    if TEST_DATABASE_URL.startswith("sqlite"):
        eng = create_engine(
            TEST_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
        )

        @event.listens_for(eng, "connect")
        def _fk_on(dbapi_conn: Any, _: Any) -> None:
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
    else:
        eng = create_engine(TEST_DATABASE_URL)
    yield eng
    eng.dispose()


@pytest.fixture
def db_session(engine: Engine) -> Iterator[Session]:
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with session_factory() as session:
        yield session
    Base.metadata.drop_all(engine)


@pytest.fixture
def anon_client(db_session: Session) -> Iterator[TestClient]:
    """Real authentication: used by the login tests."""
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_narrator] = TemplateNarrator
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client(anon_client: TestClient) -> TestClient:
    """Already signed in: every other test file just exercises the API."""
    app.dependency_overrides[get_current_user] = lambda: object()
    return anon_client


def patient_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "first_name": "Jane",
        "last_name": "Doe",
        "date_of_birth": "1980-05-17",
        "email": "jane.doe@example.com",
        "phone": "+1 (555) 123-4567",
        "address_line1": "1 Main St",
        "city": "Springfield",
        "state": "IL",
        "postal_code": "62701",
        "blood_type": "A+",
        "status": "active",
        "allergies": ["Penicillin"],
        "conditions": ["Hypertension"],
        "last_visit": (date.today() - timedelta(days=10)).isoformat(),
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def make_patient(client: TestClient):  # type: ignore[no-untyped-def]
    def _make(**overrides: Any) -> dict[str, Any]:
        res = client.post("/patients", json=patient_payload(**overrides))
        assert res.status_code == 201, res.text
        return res.json()

    return _make
