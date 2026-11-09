import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient


def test_note_lifecycle(client: TestClient, make_patient) -> None:  # type: ignore[no-untyped-def]
    pid = make_patient()["id"]
    older = (datetime.now(UTC) - timedelta(days=3)).isoformat()

    first = client.post(
        f"/patients/{pid}/notes", json={"content": "Older note.", "timestamp": older}
    )
    second = client.post(f"/patients/{pid}/notes", json={"content": "  Newer note.  "})
    assert first.status_code == second.status_code == 201
    assert second.json()["content"] == "Newer note."

    listed = client.get(f"/patients/{pid}/notes").json()
    assert [n["content"] for n in listed] == ["Newer note.", "Older note."]

    note_id = first.json()["id"]
    assert client.delete(f"/patients/{pid}/notes/{note_id}").status_code == 204
    assert len(client.get(f"/patients/{pid}/notes").json()) == 1
    assert client.delete(f"/patients/{pid}/notes/{note_id}").status_code == 404


def test_note_validation(client: TestClient, make_patient) -> None:  # type: ignore[no-untyped-def]
    pid = make_patient()["id"]
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    assert client.post(f"/patients/{pid}/notes", json={"content": "   "}).status_code == 422
    assert client.post(f"/patients/{pid}/notes", json={"content": "x" * 5001}).status_code == 422
    res = client.post(f"/patients/{pid}/notes", json={"content": "x", "timestamp": future})
    assert res.status_code == 422
    assert res.json()["error"]["fields"][0]["field"] == "timestamp"


def test_notes_for_unknown_patient(client: TestClient) -> None:
    pid = uuid.uuid4()
    assert client.get(f"/patients/{pid}/notes").status_code == 404
    assert client.post(f"/patients/{pid}/notes", json={"content": "x"}).status_code == 404


def test_cannot_delete_note_via_other_patient(client: TestClient, make_patient) -> None:  # type: ignore[no-untyped-def]
    a, b = make_patient()["id"], make_patient(first_name="Other")["id"]
    note_id = client.post(f"/patients/{a}/notes", json={"content": "x"}).json()["id"]
    assert client.delete(f"/patients/{b}/notes/{note_id}").status_code == 404


def test_summary(client: TestClient, make_patient) -> None:  # type: ignore[no-untyped-def]
    pid = make_patient()["id"]
    client.post(
        f"/patients/{pid}/notes",
        json={"content": "BP 150/95. Started lisinopril. Recheck in 4 weeks."},
    )
    res = client.get(f"/patients/{pid}/summary")
    assert res.status_code == 200
    body = res.json()
    assert body["identifiers"]["name"] == "Jane Doe"
    assert body["identifiers"]["blood_type"] == "A+"
    assert body["conditions"] == ["Hypertension"]
    assert body["allergies"] == ["Penicillin"]
    assert body["note_count"] == 1
    assert body["source"] == "template"
    assert "Jane Doe is a 4" in body["narrative"]
    assert "Started lisinopril" not in body["narrative"]  # only the first sentence
    assert "BP 150/95." in body["narrative"]


def test_summary_without_notes(client: TestClient, make_patient) -> None:  # type: ignore[no-untyped-def]
    pid = make_patient(conditions=[], allergies=[])["id"]
    narrative = client.get(f"/patients/{pid}/summary").json()["narrative"]
    assert "No chronic conditions" in narrative
    assert "no clinical notes" in narrative
