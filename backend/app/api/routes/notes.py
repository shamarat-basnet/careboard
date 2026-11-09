import uuid

from fastapi import APIRouter, Depends, status

from app.api.deps import DbSession, get_current_user
from app.core.errors import ErrorResponse
from app.schemas.note import NoteCreate, NoteRead
from app.services import notes as service

NOT_FOUND = {404: {"model": ErrorResponse, "description": "Patient or note not found"}}

router = APIRouter(
    prefix="/patients/{patient_id}/notes",
    tags=["notes"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[NoteRead], responses=NOT_FOUND)
def list_notes(db: DbSession, patient_id: uuid.UUID) -> list[NoteRead]:
    """All notes for a patient, newest first."""
    return [NoteRead.model_validate(n) for n in service.list_notes(db, patient_id)]


@router.post(
    "",
    response_model=NoteRead,
    status_code=status.HTTP_201_CREATED,
    responses={**NOT_FOUND, 422: {"model": ErrorResponse}},
)
def create_note(db: DbSession, patient_id: uuid.UUID, payload: NoteCreate) -> NoteRead:
    return NoteRead.model_validate(service.create_note(db, patient_id, payload))


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def delete_note(db: DbSession, patient_id: uuid.UUID, note_id: uuid.UUID) -> None:
    service.delete_note(db, patient_id, note_id)
