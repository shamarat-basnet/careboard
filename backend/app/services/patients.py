import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import ColumnElement, Select, case, func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models import Patient, PatientStatus
from app.schemas.patient import (
    PatientCreate,
    PatientListParams,
    PatientStats,
    PatientUpdate,
    SortField,
    SortOrder,
)


def _utc(value: datetime) -> datetime:
    # SQLite (tests) returns naive datetimes; Postgres returns aware ones.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def get_patient(db: Session, patient_id: uuid.UUID) -> Patient:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise NotFoundError(f"Patient {patient_id} not found")
    return patient


def _sort_columns(sort_by: SortField, order: SortOrder) -> list[ColumnElement[object]]:
    asc = order is SortOrder.ASC
    match sort_by:
        case SortField.NAME:
            cols = [Patient.last_name, Patient.first_name]
        case SortField.AGE:
            # Older patient = earlier DOB, so "age asc" means "date_of_birth desc".
            asc = not asc
            cols = [Patient.date_of_birth]
        case SortField.LAST_VISIT:
            cols = [Patient.last_visit]
        case SortField.STATUS:
            # By urgency (critical first), not by the database's enum order.
            cols = [
                case(
                    (Patient.status == PatientStatus.CRITICAL, 0),
                    (Patient.status == PatientStatus.ACTIVE, 1),
                    (Patient.status == PatientStatus.INACTIVE, 2),
                    else_=3,
                ),
                Patient.last_name,
            ]
        case SortField.CREATED_AT:
            cols = [Patient.created_at]
    ordered = [(c.asc() if asc else c.desc()).nulls_last() for c in cols]
    # Unique tiebreaker so offset pagination is stable across pages.
    return [*ordered, Patient.id.asc()]


def _apply_filters(
    stmt: Select[tuple[Patient]], params: PatientListParams
) -> Select[tuple[Patient]]:
    if params.search:
        # Each whitespace-separated term must match a name or the email, so
        # "jane do" finds "Jane Doe". Matches the trigram index created in migrations.
        for term in params.search.split():
            pattern = f"%{term.replace(chr(92), r'\\').replace('%', r'\%').replace('_', r'\_')}%"
            stmt = stmt.where(
                or_(
                    (Patient.first_name + " " + Patient.last_name).ilike(pattern, escape="\\"),
                    Patient.email.ilike(pattern, escape="\\"),
                )
            )
    if params.status:
        stmt = stmt.where(Patient.status.in_(params.status))
    if params.blood_type:
        stmt = stmt.where(Patient.blood_type.in_(params.blood_type))
    return stmt


def list_patients(db: Session, params: PatientListParams) -> tuple[list[Patient], int]:
    filtered = _apply_filters(select(Patient), params)
    total = db.scalar(select(func.count()).select_from(filtered.order_by(None).subquery())) or 0
    rows = db.scalars(
        filtered.order_by(*_sort_columns(params.sort_by, params.sort_order))
        .offset((params.page - 1) * params.page_size)
        .limit(params.page_size)
    ).all()
    return list(rows), total


def get_stats(db: Session) -> PatientStats:
    counts = dict(db.execute(select(Patient.status, func.count()).group_by(Patient.status)).all())
    since = date.today() - timedelta(days=30)
    recent = db.scalar(select(func.count()).where(Patient.last_visit >= since)) or 0
    by_status = {s: counts.get(s, 0) for s in PatientStatus}
    return PatientStats(
        total=sum(by_status.values()), by_status=by_status, seen_last_30_days=recent
    )


def create_patient(db: Session, data: PatientCreate) -> Patient:
    patient = Patient(**data.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


def update_patient(db: Session, patient_id: uuid.UUID, data: PatientUpdate) -> Patient:
    # Row lock so a concurrent update can't slip between the version check and the commit.
    patient = db.get(Patient, patient_id, with_for_update=True)
    if patient is None:
        raise NotFoundError(f"Patient {patient_id} not found")
    if _utc(data.updated_at) != _utc(patient.updated_at):
        raise ConflictError(
            "This patient was changed by someone else since you opened it. "
            "Reload the page to see the latest version, then re-apply your edits."
        )
    for field, value in data.model_dump(exclude={"updated_at"}).items():
        setattr(patient, field, value)
    # Set explicitly: SQLite's now() has 1s resolution, which would hide fast conflicting edits.
    patient.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(patient)
    return patient


def delete_patient(db: Session, patient_id: uuid.UUID) -> None:
    patient = get_patient(db, patient_id)
    db.delete(patient)
    db.commit()
