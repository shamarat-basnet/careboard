import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, Index, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, StringList

if TYPE_CHECKING:
    from app.models.note import Note


class BloodType(enum.StrEnum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"
    UNKNOWN = "unknown"


class PatientStatus(enum.StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    CRITICAL = "critical"
    DISCHARGED = "discharged"


def _enum_values(e: type[enum.Enum]) -> list[str]:
    return [m.value for m in e]


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    date_of_birth: Mapped[date] = mapped_column(Date)

    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(32))
    address_line1: Mapped[str | None] = mapped_column(String(200))
    address_line2: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    postal_code: Mapped[str | None] = mapped_column(String(20))

    blood_type: Mapped[BloodType] = mapped_column(
        Enum(BloodType, name="blood_type", values_callable=_enum_values),
        default=BloodType.UNKNOWN,
    )
    status: Mapped[PatientStatus] = mapped_column(
        Enum(PatientStatus, name="patient_status", values_callable=_enum_values),
        default=PatientStatus.ACTIVE,
    )
    allergies: Mapped[list[str]] = mapped_column(StringList, default=list)
    conditions: Mapped[list[str]] = mapped_column(StringList, default=list)
    last_visit: Mapped[date | None] = mapped_column(Date)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    notes: Mapped[list["Note"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Note.timestamp.desc()",
    )

    __table_args__ = (
        Index("ix_patients_last_name_first_name", "last_name", "first_name"),
        Index("ix_patients_status", "status"),
        Index("ix_patients_last_visit", "last_visit"),
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
