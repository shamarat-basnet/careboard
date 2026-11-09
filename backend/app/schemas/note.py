import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

# Allow a little clock skew between the client and the server.
FUTURE_TOLERANCE = timedelta(minutes=5)


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When the clinical observation was made. Defaults to now.",
    )
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]

    @field_validator("timestamp")
    @classmethod
    def _normalise_timestamp(cls, value: datetime) -> datetime:
        # Naive timestamps are interpreted as UTC so storage is always unambiguous.
        value = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        if value > datetime.now(UTC) + FUTURE_TOLERANCE:
            raise ValueError("cannot be in the future")
        return value


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    timestamp: datetime
    content: str
    created_at: datetime


class PatientIdentifiers(BaseModel):
    name: str
    age: int
    date_of_birth: str
    blood_type: str


class PatientSummary(BaseModel):
    patient_id: uuid.UUID
    identifiers: PatientIdentifiers
    status: str
    conditions: list[str]
    allergies: list[str]
    last_visit: str | None
    note_count: int
    narrative: str
    source: str = Field(description='"template" or "llm" - which generator wrote the narrative')
    generated_at: datetime
