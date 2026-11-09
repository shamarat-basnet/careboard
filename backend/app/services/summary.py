"""Builds a human-readable patient summary from the profile and clinical notes.

Structured facts (identifiers, conditions, allergies) always come straight from the database so
they can never be hallucinated. Only the free-text narrative is pluggable:

* ``TemplateNarrator`` - deterministic, offline, always available (the default).
* ``ClaudeNarrator``  - asks Claude to write the narrative; on any failure (no key, timeout,
  refusal, API error) it falls back to the template so the endpoint never fails because of
  the LLM.
"""

import logging
import re
from collections.abc import Sequence
from datetime import UTC, date, datetime
from typing import Protocol

import anthropic

from app.core.config import Settings
from app.models import Note, Patient
from app.schemas.note import PatientIdentifiers, PatientSummary
from app.schemas.patient import age_from

logger = logging.getLogger(__name__)

MAX_NOTES_IN_NARRATIVE = 5
MAX_NOTES_IN_PROMPT = 50
SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


def _fmt_date(value: date | datetime) -> str:
    return f"{value:%b} {value.day}, {value.year}"


def _join(items: Sequence[str]) -> str:
    items = list(items)
    if len(items) <= 2:
        return " and ".join(items)
    return f"{', '.join(items[:-1])}, and {items[-1]}"


def _first_sentence(text: str, limit: int = 220) -> str:
    sentence = SENTENCE_RE.split(text.strip(), maxsplit=1)[0]
    return sentence if len(sentence) <= limit else sentence[: limit - 1].rstrip() + "…"


class Narrator(Protocol):
    def narrate(self, patient: Patient, notes: Sequence[Note], age: int) -> tuple[str, str]:
        """Return (narrative, source)."""
        ...


class TemplateNarrator:
    def narrate(self, patient: Patient, notes: Sequence[Note], age: int) -> tuple[str, str]:
        p = patient
        blood = "unknown blood type" if p.blood_type == "unknown" else f"blood type {p.blood_type}"
        article = "an" if str(age).startswith("8") or age in (11, 18) else "a"
        parts = [
            f"{p.full_name} is {article} {age}-year-old patient ({blood}) currently {p.status}."
        ]

        if p.conditions:
            parts.append(f"Documented conditions include {_join(p.conditions)}.")
        else:
            parts.append("No chronic conditions are documented.")
        if p.allergies:
            parts.append(f"Known allergies: {_join(p.allergies)}.")
        else:
            parts.append("No known allergies.")
        if p.last_visit:
            parts.append(f"The most recent visit was on {_fmt_date(p.last_visit)}.")

        if not notes:
            parts.append("There are no clinical notes on file.")
            return " ".join(parts), "template"

        ordered = sorted(notes, key=lambda n: n.timestamp)  # chronological reads as a story
        first, last = ordered[0].timestamp, ordered[-1].timestamp
        span = (
            f"on {_fmt_date(first)}"
            if first.date() == last.date()
            else f"between {_fmt_date(first)} and {_fmt_date(last)}"
        )
        count = len(ordered)
        parts.append(f"{count} clinical note{'s' if count != 1 else ''} recorded {span}.")

        recent = ordered[-MAX_NOTES_IN_NARRATIVE:]
        if count > len(recent):
            parts.append(f"The {len(recent)} most recent notes:")
        parts.extend(f"On {_fmt_date(n.timestamp)}: {_first_sentence(n.content)}" for n in recent)
        return " ".join(parts), "template"


SYSTEM_PROMPT = """You write concise clinical summaries for clinicians at a medical practice.
Given a patient's profile and their clinical notes, write one short paragraph (3-6 sentences)
that synthesises the clinical picture: the patient's situation, how it has evolved across the
notes, and anything that needs follow-up. Identifying details are deliberately omitted from the
input; refer to the person as "the patient". Use only facts present in the input; never invent
diagnoses, medications, or values. Plain prose only - no headings, bullet points, or markdown."""


class ClaudeNarrator:
    def __init__(self, settings: Settings, fallback: Narrator) -> None:
        self._fallback = fallback
        self._model = settings.anthropic_model
        # Short timeout and a single retry: a slow LLM must not make the page hang.
        self._client = anthropic.Anthropic(
            api_key=settings.anthropic_api_key, timeout=30.0, max_retries=1
        )

    def _prompt(self, patient: Patient, notes: Sequence[Note], age: int) -> str:
        p = patient
        lines = [
            f"Age: {age}",
            f"Blood type: {p.blood_type}",
            f"Status: {p.status}",
            f"Conditions: {', '.join(p.conditions) or 'none documented'}",
            f"Allergies: {', '.join(p.allergies) or 'none known'}",
            f"Last visit: {p.last_visit.isoformat() if p.last_visit else 'unknown'}",
            "",
            f"Clinical notes, oldest first (most recent {MAX_NOTES_IN_PROMPT} of {len(notes)}):",
        ]
        for n in sorted(notes, key=lambda n: n.timestamp)[-MAX_NOTES_IN_PROMPT:]:
            lines.append(f"- [{n.timestamp:%Y-%m-%d %H:%M}] {n.content}")
        if not notes:
            lines.append("- (none)")
        return "\n".join(lines)

    def narrate(self, patient: Patient, notes: Sequence[Note], age: int) -> tuple[str, str]:
        try:
            response = self._client.beta.messages.create(
                model=self._model,
                max_tokens=2000,
                output_config={"effort": "low"},
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": self._prompt(patient, notes, age)}],
            )
        except anthropic.APIError as exc:
            logger.warning("LLM summary failed, using template: %s", exc)
            return self._fallback.narrate(patient, notes, age)

        if response.stop_reason == "refusal":
            logger.warning("LLM summary refused, using template")
            return self._fallback.narrate(patient, notes, age)
        text = "".join(b.text for b in response.content if b.type == "text").strip()
        if not text:
            return self._fallback.narrate(patient, notes, age)
        return text, "llm"


def build_narrator(settings: Settings) -> Narrator:
    template = TemplateNarrator()
    if settings.summary_provider == "llm" and settings.anthropic_api_key:
        return ClaudeNarrator(settings, fallback=template)
    return template


def build_summary(patient: Patient, notes: Sequence[Note], narrator: Narrator) -> PatientSummary:
    age = age_from(patient.date_of_birth, date.today())
    narrative, source = narrator.narrate(patient, notes, age)
    return PatientSummary(
        patient_id=patient.id,
        identifiers=PatientIdentifiers(
            name=patient.full_name,
            age=age,
            date_of_birth=patient.date_of_birth.isoformat(),
            blood_type=str(patient.blood_type),
        ),
        status=str(patient.status),
        conditions=list(patient.conditions),
        allergies=list(patient.allergies),
        last_visit=patient.last_visit.isoformat() if patient.last_visit else None,
        note_count=len(notes),
        narrative=narrative,
        source=source,
        generated_at=datetime.now(UTC),
    )
