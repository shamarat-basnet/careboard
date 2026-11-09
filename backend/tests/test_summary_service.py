from datetime import date
from types import SimpleNamespace

import anthropic
import httpx2

from app.core.config import Settings
from app.models import Patient
from app.services.summary import ClaudeNarrator, TemplateNarrator, build_narrator


def _patient() -> Patient:
    return Patient(
        first_name="Ada",
        last_name="Lovelace",
        date_of_birth=date(1980, 1, 1),
        blood_type="O+",
        status="active",
        conditions=[],
        allergies=[],
        last_visit=None,
    )


def test_template_used_without_api_key() -> None:
    narrator = build_narrator(Settings(summary_provider="llm", anthropic_api_key=None))
    assert isinstance(narrator, TemplateNarrator)


def test_llm_failure_falls_back_to_template(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    narrator = build_narrator(Settings(summary_provider="llm", anthropic_api_key="test-key"))
    assert isinstance(narrator, ClaudeNarrator)

    def boom(**_: object) -> None:
        raise anthropic.APIConnectionError(request=httpx2.Request("POST", "https://x"))

    monkeypatch.setattr(narrator._client.beta.messages, "create", boom)
    text, source = narrator.narrate(_patient(), [], 46)
    assert source == "template"
    assert text.startswith("Ada Lovelace is a 46-year-old patient")


def test_template_uses_correct_article() -> None:
    p = _patient()
    assert TemplateNarrator().narrate(p, [], 80)[0].startswith("Ada Lovelace is an 80-year-old")
    assert TemplateNarrator().narrate(p, [], 18)[0].startswith("Ada Lovelace is an 18-year-old")
    assert TemplateNarrator().narrate(p, [], 46)[0].startswith("Ada Lovelace is a 46-year-old")


def _llm_narrator(monkeypatch, response):  # type: ignore[no-untyped-def]
    narrator = build_narrator(Settings(summary_provider="llm", anthropic_api_key="test-key"))
    captured: dict = {}

    def fake_create(**kwargs):  # type: ignore[no-untyped-def]
        captured.update(kwargs)
        return response

    monkeypatch.setattr(narrator._client.beta.messages, "create", fake_create)
    return narrator, captured


def _response(stop_reason, text):  # type: ignore[no-untyped-def]
    block = SimpleNamespace(type="text", text=text)
    return SimpleNamespace(stop_reason=stop_reason, content=[block])


def test_llm_success_returns_model_text_and_omits_name(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    narrator, sent = _llm_narrator(monkeypatch, _response("end_turn", "  Stable. "))
    text, source = narrator.narrate(_patient(), [], 46)
    assert (text, source) == ("Stable.", "llm")
    assert "Lovelace" not in str(sent["messages"])  # patient name is never sent
    assert sent["fallbacks"] == "default"


def test_llm_refusal_falls_back_to_template(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    narrator, _ = _llm_narrator(monkeypatch, _response("refusal", ""))
    assert narrator.narrate(_patient(), [], 46)[1] == "template"


def test_llm_prompt_is_capped_to_recent_notes() -> None:
    from datetime import UTC, datetime, timedelta

    from app.models import Note
    from app.services.summary import MAX_NOTES_IN_PROMPT

    narrator = build_narrator(Settings(summary_provider="llm", anthropic_api_key="test-key"))
    start = datetime(2026, 1, 1, tzinfo=UTC)
    notes = [Note(timestamp=start + timedelta(days=i), content=f"note-{i}") for i in range(80)]
    prompt = narrator._prompt(_patient(), notes, 46)
    assert prompt.count("\n- [") == MAX_NOTES_IN_PROMPT
    assert "note-79" in prompt and "note-0\n" not in prompt
