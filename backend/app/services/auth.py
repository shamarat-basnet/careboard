import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import InvalidCredentialsError, TooManyAttemptsError
from app.core.security import (
    DUMMY_HASH,
    hash_password,
    hash_token,
    new_session_token,
    verify_password,
)
from app.models import User, UserSession

logger = logging.getLogger(__name__)

MIN_PASSWORD_LENGTH = 12


def _utc(value: datetime) -> datetime:
    # SQLite (tests) returns naive datetimes; Postgres returns aware ones.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def create_user(db: Session, email: str, name: str, password: str) -> User:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    user = User(email=email.strip().lower(), name=name, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    return user


def login(db: Session, email: str, password: str, settings: Settings) -> tuple[User, str]:
    """Check credentials and start a session. Returns the user and the raw cookie token."""
    now = datetime.now(UTC)
    # Row lock: concurrent attempts on one account are counted one after another.
    user = db.scalar(select(User).where(User.email == email).with_for_update())

    if user is None:
        verify_password(password, DUMMY_HASH)  # same cost as a real check
        raise InvalidCredentialsError("Incorrect email or password.")

    if user.locked_until and _utc(user.locked_until) > now:
        db.rollback()
        raise TooManyAttemptsError(
            f"Too many failed attempts. Try again in {settings.lockout_minutes} minutes."
        )

    if not verify_password(password, user.password_hash):
        user.failed_attempts += 1
        if user.failed_attempts >= settings.max_login_attempts:
            user.locked_until = now + timedelta(minutes=settings.lockout_minutes)
            user.failed_attempts = 0
            logger.warning("Account locked after repeated failures: user_id=%s", user.id)
        db.commit()
        raise InvalidCredentialsError("Incorrect email or password.")

    user.failed_attempts = 0
    user.locked_until = None
    token = new_session_token()
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=now + timedelta(hours=settings.session_ttl_hours),
        )
    )
    db.execute(delete(UserSession).where(UserSession.expires_at < now))  # tidy old sessions
    db.commit()
    return user, token


def user_for_token(db: Session, token: str) -> User | None:
    row = db.execute(
        select(User, UserSession.expires_at)
        .join(UserSession, UserSession.user_id == User.id)
        .where(UserSession.token_hash == hash_token(token))
    ).first()
    if row is None or _utc(row.expires_at) <= datetime.now(UTC):
        return None
    return row.User


def logout(db: Session, token: str) -> None:
    db.execute(delete(UserSession).where(UserSession.token_hash == hash_token(token)))
    db.commit()
