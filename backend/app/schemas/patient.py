import re
import uuid
from datetime import date, datetime, timedelta
from enum import StrEnum
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    ValidationInfo,
    computed_field,
    field_validator,
)

from app.models.patient import BloodType, PatientStatus
from app.schemas.common import OptionalStr, blank_to_none

NAME_RE = re.compile(r"^[^\W\d_](?:[^\W\d_]|[ '.-])*$")
PHONE_RE = re.compile(r"^\+?[0-9 ()\-.]{7,20}$")
MAX_AGE_YEARS = 130


def _validate_name(value: str) -> str:
    if not NAME_RE.match(value):
        raise ValueError("may only contain letters, spaces, hyphens, apostrophes and periods")
    return value


def _validate_phone(value: str | None) -> str | None:
    if value is None:
        return None
    if not PHONE_RE.match(value) or sum(c.isdigit() for c in value) < 7:
        raise ValueError("must be a valid phone number, e.g. +1 (555) 123-4567")
    return value


def _clean_list(values: list[str]) -> list[str]:
    """Trim items, drop blanks, and de-duplicate case-insensitively while preserving order."""
    seen: set[str] = set()
    result: list[str] = []
    for raw in values:
        item = raw.strip()
        if not item:
            continue
        if len(item) > 100:
            raise ValueError("each item must be at most 100 characters")
        if item.lower() not in seen:
            seen.add(item.lower())
            result.append(item)
    return result


Name = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
    AfterValidator(_validate_name),
]
ClinicalList = Annotated[list[str], Field(max_length=50), AfterValidator(_clean_list)]


def _latest_allowed() -> date:
    # One day of slack: a client ahead of UTC can already be on "tomorrow" by the server's clock.
    return date.today() + timedelta(days=1)


def age_from(dob: date, today: date) -> int:
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


class PatientBase(BaseModel):
    first_name: Name
    last_name: Name
    date_of_birth: date

    email: Annotated[EmailStr | None, BeforeValidator(blank_to_none)] = None
    phone: Annotated[OptionalStr(32), AfterValidator(_validate_phone)] = None
    address_line1: OptionalStr(200) = None
    address_line2: OptionalStr(200) = None
    city: OptionalStr(100) = None
    state: OptionalStr(100) = None
    postal_code: OptionalStr(20) = None

    blood_type: BloodType = BloodType.UNKNOWN
    status: PatientStatus = PatientStatus.ACTIVE
    allergies: ClinicalList = []
    conditions: ClinicalList = []
    last_visit: date | None = None

    @field_validator("date_of_birth")
    @classmethod
    def _check_dob(cls, value: date) -> date:
        today = date.today()
        if value > _latest_allowed():
            raise ValueError("cannot be in the future")
        if age_from(value, today) > MAX_AGE_YEARS:
            raise ValueError(f"implies an age over {MAX_AGE_YEARS} years")
        return value

    @field_validator("last_visit")
    @classmethod
    def _check_last_visit(cls, value: date | None, info: ValidationInfo) -> date | None:
        if value is None:
            return None
        if value > _latest_allowed():
            raise ValueError("cannot be in the future")
        dob = info.data.get("date_of_birth")
        if dob is not None and value < dob:
            raise ValueError("cannot be before the date of birth")
        return value


class PatientCreate(PatientBase):
    model_config = ConfigDict(extra="forbid")


class PatientUpdate(PatientBase):
    """PUT replaces the full resource, so the update payload mirrors the create payload.

    `updated_at` is the version the client last loaded; the update is rejected (409) if the
    record changed since, so two editors can't silently overwrite each other.
    """

    model_config = ConfigDict(extra="forbid")

    updated_at: datetime


class _AgeMixin(BaseModel):
    date_of_birth: date

    @computed_field  # type: ignore[prop-decorator]
    @property
    def age(self) -> int:
        return age_from(self.date_of_birth, date.today())


class PatientListItem(_AgeMixin):
    """Lightweight projection used by the list endpoint."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    email: str | None
    blood_type: BloodType
    status: PatientStatus
    last_visit: date | None
    conditions: list[str]


class PatientRead(_AgeMixin):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    email: str | None
    phone: str | None
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    postal_code: str | None
    blood_type: BloodType
    status: PatientStatus
    allergies: list[str]
    conditions: list[str]
    last_visit: date | None
    created_at: datetime
    updated_at: datetime


class SortField(StrEnum):
    NAME = "name"
    AGE = "age"
    LAST_VISIT = "last_visit"
    STATUS = "status"
    CREATED_AT = "created_at"


class SortOrder(StrEnum):
    ASC = "asc"
    DESC = "desc"


class PatientListParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    search: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    status: list[PatientStatus] = []
    blood_type: list[BloodType] = []
    sort_by: SortField = SortField.NAME
    sort_order: SortOrder = SortOrder.ASC


class PatientStats(BaseModel):
    total: int
    by_status: dict[PatientStatus, int]
    seen_last_30_days: int
