"""Initial schema: patients and notes.

Revision ID: 0001
Revises:
Create Date: 2026-11-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BLOOD_TYPES = ("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown")
STATUSES = ("active", "inactive", "critical", "discharged")


def upgrade() -> None:
    # Trigram index makes the "%term%" name search use an index instead of a full scan.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "patients",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(32), nullable=True),
        sa.Column("address_line1", sa.String(200), nullable=True),
        sa.Column("address_line2", sa.String(200), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("postal_code", sa.String(20), nullable=True),
        sa.Column(
            "blood_type",
            sa.Enum(*BLOOD_TYPES, name="blood_type"),
            nullable=False,
            server_default="unknown",
        ),
        sa.Column(
            "status",
            sa.Enum(*STATUSES, name="patient_status"),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "allergies",
            postgresql.ARRAY(sa.String(100)),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "conditions",
            postgresql.ARRAY(sa.String(100)),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("last_visit", sa.Date(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_patients")),
    )
    op.create_index("ix_patients_last_name_first_name", "patients", ["last_name", "first_name"])
    op.create_index("ix_patients_status", "patients", ["status"])
    op.create_index("ix_patients_last_visit", "patients", ["last_visit"])
    op.execute(
        "CREATE INDEX ix_patients_full_name_trgm ON patients "
        "USING gin ((first_name || ' ' || last_name) gin_trgm_ops)"
    )

    op.create_table(
        "notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            name=op.f("fk_notes_patient_id_patients"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notes")),
    )
    op.create_index("ix_notes_patient_id_timestamp", "notes", ["patient_id", "timestamp"])


def downgrade() -> None:
    op.drop_table("notes")
    op.drop_table("patients")
    sa.Enum(name="patient_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="blood_type").drop(op.get_bind(), checkfirst=True)
