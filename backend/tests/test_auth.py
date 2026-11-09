from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models import UserSession
from app.services.auth import create_user

EMAIL, PASSWORD = "doc@example.com", "correct-horse-battery"


@pytest.fixture
def user(db_session: Session):  # type: ignore[no-untyped-def]
    return create_user(db_session, EMAIL, "Dr. Doc", PASSWORD)


def login(c: TestClient, password: str = PASSWORD, email: str = EMAIL):  # type: ignore[no-untyped-def]
    return c.post("/auth/login", json={"email": email, "password": password})


def test_password_hashing() -> None:
    stored = hash_password("s3cret-passphrase")
    assert stored.startswith("scrypt$") and "s3cret" not in stored
    assert verify_password("s3cret-passphrase", stored)
    assert not verify_password("wrong", stored)
    assert not verify_password("x", "garbage")
    assert hash_password("a") != hash_password("a")  # salted


def test_short_passwords_are_refused(db_session: Session) -> None:
    with pytest.raises(ValueError):
        create_user(db_session, "a@example.com", "A", "short")


def test_data_routes_require_login(anon_client: TestClient, user) -> None:  # type: ignore[no-untyped-def]
    for method, path in [
        ("GET", "/patients"),
        ("GET", "/patients/stats"),
        ("POST", "/patients"),
        ("GET", "/patients/00000000-0000-0000-0000-000000000000/notes"),
        ("GET", "/auth/me"),
    ]:
        res = anon_client.request(method, path, json={} if method == "POST" else None)
        assert res.status_code == 401, (method, path)
        assert res.json()["error"]["code"] == "unauthorized"
    assert anon_client.get("/health").status_code == 200


def test_login_sets_a_locked_down_cookie(anon_client: TestClient, user) -> None:  # type: ignore[no-untyped-def]
    res = login(anon_client)
    assert res.status_code == 200
    assert res.json()["email"] == EMAIL and "password" not in res.text
    cookie = res.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "path=/" in cookie
    assert anon_client.get("/auth/me").json()["name"] == "Dr. Doc"
    assert anon_client.get("/patients").status_code == 200


def test_email_is_case_insensitive(anon_client: TestClient, user) -> None:  # type: ignore[no-untyped-def]
    assert login(anon_client, email="  DOC@Example.com ").status_code == 200


def test_wrong_credentials_give_the_same_answer(anon_client: TestClient, user) -> None:  # type: ignore[no-untyped-def]
    wrong_pw = login(anon_client, password="nope-nope-nope")
    unknown = login(anon_client, email="ghost@example.com")
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json() == unknown.json()  # can't tell which emails exist


def test_logout_revokes_the_session(anon_client: TestClient, user) -> None:  # type: ignore[no-untyped-def]
    login(anon_client)
    stolen = anon_client.cookies.get("session")
    assert anon_client.post("/auth/logout").status_code == 204
    assert anon_client.get("/auth/me").status_code == 401
    # Even a copied cookie no longer works: the session is gone server-side.
    assert anon_client.get("/auth/me", headers={"Cookie": f"session={stolen}"}).status_code == 401


def test_expired_session_is_rejected(anon_client: TestClient, user, db_session: Session) -> None:  # type: ignore[no-untyped-def]
    login(anon_client)
    past = datetime.now(UTC) - timedelta(minutes=1)
    db_session.execute(update(UserSession).values(expires_at=past))
    db_session.commit()
    assert anon_client.get("/auth/me").status_code == 401


def test_account_locks_after_repeated_failures(anon_client: TestClient, user) -> None:  # type: ignore[no-untyped-def]
    limit = get_settings().max_login_attempts
    for _ in range(limit):
        assert login(anon_client, password="bad-password-1").status_code == 401
    locked = login(anon_client)  # even the right password is refused while locked
    assert locked.status_code == 429
    assert locked.json()["error"]["code"] == "too_many_attempts"


def test_failed_attempts_reset_after_success(anon_client: TestClient, user) -> None:  # type: ignore[no-untyped-def]
    for _ in range(get_settings().max_login_attempts - 1):
        login(anon_client, password="bad-password-1")
    assert login(anon_client).status_code == 200
    for _ in range(get_settings().max_login_attempts - 1):
        assert login(anon_client, password="bad-password-1").status_code == 401
    assert login(anon_client).status_code == 200


def test_login_validates_input(anon_client: TestClient) -> None:
    assert anon_client.post("/auth/login", json={"email": "", "password": "x"}).status_code == 422
    assert anon_client.post("/auth/login", json={"email": "a@b.co"}).status_code == 422
    big = {"email": "a@b.co", "password": "x" * 1000}
    assert anon_client.post("/auth/login", json=big).status_code == 422
