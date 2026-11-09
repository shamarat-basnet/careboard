import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from tests.conftest import patient_payload


def field_errors(res) -> dict[str, str]:  # type: ignore[no-untyped-def]
    return {f["field"]: f["message"] for f in res.json()["error"]["fields"]}


class TestCreate:
    def test_creates_patient_with_computed_age(self, client: TestClient) -> None:
        res = client.post("/patients", json=patient_payload())
        assert res.status_code == 201
        body = res.json()
        assert body["first_name"] == "Jane"
        assert body["age"] >= 46
        assert res.headers["Location"] == f"/patients/{body['id']}"

    def test_normalises_input(self, client: TestClient) -> None:
        res = client.post(
            "/patients",
            json=patient_payload(
                first_name="  Jane ", email="", allergies=["Latex", " latex ", ""]
            ),
        )
        body = res.json()
        assert body["first_name"] == "Jane"
        assert body["email"] is None
        assert body["allergies"] == ["Latex"]

    @pytest.mark.parametrize(
        ("overrides", "field"),
        [
            ({"first_name": ""}, "first_name"),
            ({"first_name": "J4ne"}, "first_name"),
            ({"email": "not-an-email"}, "email"),
            ({"phone": "call me"}, "phone"),
            ({"blood_type": "C+"}, "blood_type"),
            ({"status": "sleeping"}, "status"),
            ({"date_of_birth": (date.today() + timedelta(days=2)).isoformat()}, "date_of_birth"),
            ({"last_visit": "1970-01-01"}, "last_visit"),
            ({"unexpected": 1}, "unexpected"),
        ],
    )
    def test_rejects_invalid_input(self, client: TestClient, overrides: dict, field: str) -> None:
        res = client.post("/patients", json=patient_payload(**overrides))
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "validation_error"
        assert field in field_errors(res)

    def test_accepts_today_for_clients_ahead_of_utc(self, client: TestClient) -> None:
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        res = client.post("/patients", json=patient_payload(last_visit=tomorrow))
        assert res.status_code == 201

    def test_rejects_missing_required_fields(self, client: TestClient) -> None:
        res = client.post("/patients", json={})
        assert res.status_code == 422
        assert {"first_name", "last_name", "date_of_birth"} <= field_errors(res).keys()


class TestReadUpdateDelete:
    def test_get(self, client: TestClient, make_patient) -> None:  # type: ignore[no-untyped-def]
        created = make_patient()
        res = client.get(f"/patients/{created['id']}")
        assert res.status_code == 200
        assert res.json() == created

    def test_get_unknown_returns_404(self, client: TestClient) -> None:
        res = client.get(f"/patients/{uuid.uuid4()}")
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "not_found"

    def test_get_malformed_id_returns_422(self, client: TestClient) -> None:
        assert client.get("/patients/not-a-uuid").status_code == 422

    def test_put_replaces(self, client: TestClient, make_patient) -> None:  # type: ignore[no-untyped-def]
        created = make_patient()
        res = client.put(
            f"/patients/{created['id']}",
            json=patient_payload(
                status="critical", conditions=[], email=None, updated_at=created["updated_at"]
            ),
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "critical"
        assert body["conditions"] == []
        assert body["email"] is None

    def test_put_validates(self, client: TestClient, make_patient) -> None:  # type: ignore[no-untyped-def]
        created = make_patient()
        res = client.put(
            f"/patients/{created['id']}",
            json=patient_payload(last_name="", updated_at=created["updated_at"]),
        )
        assert res.status_code == 422

    def test_put_unknown_returns_404(self, client: TestClient) -> None:
        res = client.put(
            f"/patients/{uuid.uuid4()}",
            json=patient_payload(updated_at="2026-01-01T00:00:00Z"),
        )
        assert res.status_code == 404

    def test_put_with_stale_version_conflicts(self, client: TestClient, make_patient) -> None:  # type: ignore[no-untyped-def]
        created = make_patient()
        first = client.put(
            f"/patients/{created['id']}",
            json=patient_payload(allergies=["Latex"], updated_at=created["updated_at"]),
        )
        assert first.status_code == 200
        # A second editor still holding the original version must not overwrite the first.
        stale = client.put(
            f"/patients/{created['id']}",
            json=patient_payload(allergies=[], updated_at=created["updated_at"]),
        )
        assert stale.status_code == 409
        assert stale.json()["error"]["code"] == "conflict"
        assert client.get(f"/patients/{created['id']}").json()["allergies"] == ["Latex"]

    def test_put_requires_version(self, client: TestClient, make_patient) -> None:  # type: ignore[no-untyped-def]
        created = make_patient()
        res = client.put(f"/patients/{created['id']}", json=patient_payload())
        assert res.status_code == 422
        assert "updated_at" in field_errors(res)

    def test_delete_cascades_notes(self, client: TestClient, make_patient) -> None:  # type: ignore[no-untyped-def]
        created = make_patient()
        client.post(f"/patients/{created['id']}/notes", json={"content": "hello"})
        assert client.delete(f"/patients/{created['id']}").status_code == 204
        assert client.get(f"/patients/{created['id']}").status_code == 404
        assert client.delete(f"/patients/{created['id']}").status_code == 404


class TestList:
    @pytest.fixture
    def seeded(self, make_patient) -> None:  # type: ignore[no-untyped-def]
        today = date.today()
        make_patient(
            first_name="Alice",
            last_name="Zephyr",
            date_of_birth="1990-01-01",
            status="active",
            last_visit=(today - timedelta(days=5)).isoformat(),
        )
        make_patient(
            first_name="Bob",
            last_name="Young",
            date_of_birth="1950-01-01",
            status="critical",
            blood_type="O-",
            last_visit=None,
        )
        make_patient(
            first_name="Carol",
            last_name="Xu",
            date_of_birth="2010-01-01",
            status="inactive",
            email="carol@clinic.org",
            last_visit=(today - timedelta(days=100)).isoformat(),
        )

    def names(self, res) -> list[str]:  # type: ignore[no-untyped-def]
        return [p["first_name"] for p in res.json()["items"]]

    def test_default_sort_by_last_name(self, client: TestClient, seeded: None) -> None:
        res = client.get("/patients")
        assert res.status_code == 200
        assert self.names(res) == ["Carol", "Bob", "Alice"]
        assert res.json()["total"] == 3

    def test_pagination(self, client: TestClient, seeded: None) -> None:
        res = client.get("/patients", params={"page": 2, "page_size": 2})
        body = res.json()
        assert body["total"] == 3 and body["pages"] == 2 and body["page"] == 2
        assert self.names(res) == ["Alice"]

    def test_out_of_range_page_is_empty(self, client: TestClient, seeded: None) -> None:
        assert client.get("/patients", params={"page": 9}).json()["items"] == []

    @pytest.mark.parametrize(
        ("params", "expected"),
        [
            ({"search": "ali"}, ["Alice"]),
            ({"search": "bob young"}, ["Bob"]),
            ({"search": "clinic.org"}, ["Carol"]),
            ({"search": "100%"}, []),
            ({"search": "\\"}, []),
            ({"status": ["critical", "inactive"]}, ["Carol", "Bob"]),
            ({"blood_type": "O-"}, ["Bob"]),
            ({"sort_by": "age", "sort_order": "desc"}, ["Bob", "Alice", "Carol"]),
            ({"sort_by": "status"}, ["Bob", "Alice", "Carol"]),  # critical, active, inactive
            ({"sort_by": "last_visit", "sort_order": "desc"}, ["Alice", "Carol", "Bob"]),
            ({"sort_by": "last_visit", "sort_order": "asc"}, ["Carol", "Alice", "Bob"]),
        ],
    )
    def test_filters_and_sorting(
        self, client: TestClient, seeded: None, params: dict, expected: list[str]
    ) -> None:
        res = client.get("/patients", params=params)
        assert res.status_code == 200, res.text
        assert self.names(res) == expected

    @pytest.mark.parametrize(
        "params",
        [{"page": 0}, {"page_size": 101}, {"sort_by": "ssn"}, {"status": "zombie"}, {"foo": "1"}],
    )
    def test_invalid_query_params(self, client: TestClient, params: dict) -> None:
        assert client.get("/patients", params=params).status_code == 422

    def test_stats(self, client: TestClient, seeded: None) -> None:
        body = client.get("/patients/stats").json()
        assert body["total"] == 3
        assert body["by_status"] == {"active": 1, "inactive": 1, "critical": 1, "discharged": 0}
        assert body["seen_last_30_days"] == 1
