from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

_settings = get_settings()

if _settings.serverless:
    # Each invocation is short-lived and the database sits behind a connection pooler
    # (pgbouncer in transaction mode), which doesn't support server-side prepared statements.
    engine = create_engine(
        _settings.database_url, poolclass=NullPool, connect_args={"prepare_threshold": None}
    )
else:
    engine = create_engine(_settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
