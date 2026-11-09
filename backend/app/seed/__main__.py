"""Seed the database if it is empty. Safe to run on every start-up.

Usage: python -m app.seed
"""

import logging

from sqlalchemy import func, select, text

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import SessionLocal
from app.models import Patient
from app.seed import ADVISORY_LOCK_ID
from app.seed.data import build_patients

logger = logging.getLogger("app.seed")


def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    with SessionLocal() as db:
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": ADVISORY_LOCK_ID})
        existing = db.scalar(select(func.count()).select_from(Patient)) or 0
        if existing:
            logger.info("Database already has %d patients; skipping seed.", existing)
            return
        patients = build_patients(settings.seed_patient_count)
        db.add_all(patients)
        db.commit()
        logger.info("Seeded %d patients.", len(patients))


if __name__ == "__main__":
    main()
