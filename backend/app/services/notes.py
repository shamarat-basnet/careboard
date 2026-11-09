import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import Note
from app.schemas.note import NoteCreate
from app.services.patients import get_patient


def list_notes(db: Session, patient_id: uuid.UUID) -> list[Note]:
    get_patient(db, patient_id)  # 404 for unknown patients rather than an empty list
    stmt = (
        select(Note).where(Note.patient_id == patient_id).order_by(Note.timestamp.desc(), Note.id)
    )
    return list(db.scalars(stmt).all())


def create_note(db: Session, patient_id: uuid.UUID, data: NoteCreate) -> Note:
    get_patient(db, patient_id)
    note = Note(patient_id=patient_id, timestamp=data.timestamp, content=data.content)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, patient_id: uuid.UUID, note_id: uuid.UUID) -> None:
    get_patient(db, patient_id)
    note = db.scalar(select(Note).where(Note.id == note_id, Note.patient_id == patient_id))
    if note is None:
        raise NotFoundError(f"Note {note_id} not found for patient {patient_id}")
    db.delete(note)
    db.commit()
