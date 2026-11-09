import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import DbSession, get_current_user, get_narrator
from app.core.errors import ErrorResponse
from app.schemas.common import Page
from app.schemas.note import PatientSummary
from app.schemas.patient import (
    PatientCreate,
    PatientListItem,
    PatientListParams,
    PatientRead,
    PatientStats,
    PatientUpdate,
)
from app.services import notes as notes_service
from app.services import patients as service
from app.services.summary import Narrator, build_summary

NOT_FOUND = {404: {"model": ErrorResponse, "description": "Patient not found"}}
INVALID = {422: {"model": ErrorResponse, "description": "Validation error"}}

router = APIRouter(prefix="/patients", tags=["patients"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=Page[PatientListItem], responses=INVALID)
def list_patients(db: DbSession, params: Annotated[PatientListParams, Query()]) -> Page:
    """Paginated list with optional search, status/blood-type filters, and sorting."""
    items, total = service.list_patients(db, params)
    return Page.build(
        [PatientListItem.model_validate(p) for p in items], total, params.page, params.page_size
    )


@router.get("/stats", response_model=PatientStats)
def patient_stats(db: DbSession) -> PatientStats:
    return service.get_stats(db)


@router.post("", response_model=PatientRead, status_code=status.HTTP_201_CREATED, responses=INVALID)
def create_patient(db: DbSession, payload: PatientCreate, response: Response) -> PatientRead:
    patient = service.create_patient(db, payload)
    response.headers["Location"] = f"/patients/{patient.id}"
    return PatientRead.model_validate(patient)


@router.get("/{patient_id}", response_model=PatientRead, responses=NOT_FOUND)
def get_patient(db: DbSession, patient_id: uuid.UUID) -> PatientRead:
    return PatientRead.model_validate(service.get_patient(db, patient_id))


@router.put("/{patient_id}", response_model=PatientRead, responses={**NOT_FOUND, **INVALID})
def update_patient(db: DbSession, patient_id: uuid.UUID, payload: PatientUpdate) -> PatientRead:
    return PatientRead.model_validate(service.update_patient(db, patient_id, payload))


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def delete_patient(db: DbSession, patient_id: uuid.UUID) -> None:
    service.delete_patient(db, patient_id)


@router.get("/{patient_id}/summary", response_model=PatientSummary, responses=NOT_FOUND)
def patient_summary(
    db: DbSession,
    patient_id: uuid.UUID,
    narrator: Annotated[Narrator, Depends(get_narrator)],
) -> PatientSummary:
    patient = service.get_patient(db, patient_id)
    notes = notes_service.list_notes(db, patient_id)
    return build_summary(patient, notes, narrator)
