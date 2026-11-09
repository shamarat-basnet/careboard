"""Trigram index on email so the OR in patient search can use indexes for both branches.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-08
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE INDEX ix_patients_email_trgm ON patients USING gin (email gin_trgm_ops)")


def downgrade() -> None:
    op.execute("DROP INDEX ix_patients_email_trgm")
