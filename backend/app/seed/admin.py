"""Create the first user from ADMIN_EMAIL / ADMIN_PASSWORD when no users exist.

Usage: python -m app.seed.admin   (safe to run on every start-up)
"""

import logging
import sys

from sqlalchemy import func, select, text

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import SessionLocal
from app.models import User
from app.seed import ADVISORY_LOCK_ID
from app.services.auth import create_user

logger = logging.getLogger("app.seed.admin")

DEMO_PASSWORD = (
    "ChangeMe-Demo-2026"  # the docker-compose default; fine locally, never in production
)


def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    with SessionLocal() as db:
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": ADVISORY_LOCK_ID})
        if db.scalar(select(func.count()).select_from(User)):
            return
        if not (settings.admin_email and settings.admin_password):
            logger.warning(
                "No users exist and ADMIN_EMAIL/ADMIN_PASSWORD are unset: nobody can log in."
            )
            return
        try:
            create_user(db, settings.admin_email, settings.admin_name, settings.admin_password)
        except ValueError as exc:
            logger.error("Cannot create the admin user: %s", exc)
            sys.exit(1)
        logger.info("Created user %s.", settings.admin_email.lower())
        if settings.admin_password == DEMO_PASSWORD:
            logger.warning(
                "The demo admin password is in use. Set ADMIN_PASSWORD before deploying."
            )


if __name__ == "__main__":
    main()
