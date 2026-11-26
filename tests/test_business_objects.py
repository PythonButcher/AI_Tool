"""Verify the same definition contract with independently configured objects."""

from contextlib import closing
from io import BytesIO
from pathlib import Path
import sqlite3

from flask import Flask
import pytest

from backend.db import backend_db
from backend.repositories.source_workspace_repository import get_source_private_locator, get_workspace
from backend.routes.data_workspaces import data_workspaces_bp
from backend.routes.upload import upload_bp
from backend.services import business_objects, source_relationships, workspace_context


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(backend_db, "DB_PATH", str(tmp_path / "objects.db"))
    monkeypatch.setattr(backend_db, "_SCHEMA_READY", False)
    monkeypatch.setattr(workspace_context, "MANAGED_UPLOAD_ROOT", tmp_path / "managed")
    app = Flask(__name__)
    app.register_blueprint(upload_bp)
    app.register_blueprint(data_workspaces_bp)
    return app.test_client()


def _upload(client, filename, csv):
    response = client.post("/api/upload", data={"file": (BytesIO(csv), filename)})
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def _relationship(workspace, left, right, left_field, right_field):
    return source_relationships.create_relationship(workspace, {
        "left_source_id": left,
        "right_source_id": right,
        "field_pairs": [{"left_field": left_field, "right_field": right_field}],
        "cardinality": "one_to_many",
        "join_behavior": "left",
        "filter_direction": "left_to_right",
    })["relationship_id"]


def _attach(workspace, source):
    workspace_context.add_source_to_workspace(
        workspace_id=workspace, source_id=source, version=get_workspace(workspace)["version"],
    )


@pytest.fixture
def model(client):
    customers = _upload(client, "customers.csv", b"customer_id,name\n1,Ada\n2,Lin\n")
    equipment = _upload(client, "equipment.csv", b"asset_tag,title\nA-1,Pump\nA-2,Motor\n")
    orders = _upload(client, "orders.csv", b"buyer,total\n1,12\n1,8\n")
    maintenance = _upload(client, "maintenance.csv", b"equipment_ref,work\nA-1,Inspect\nA-2,Replace\n")
    workspace = customers["workspace"]["workspace_id"]
    customer, asset, order, service = [
        item["source"]["source_id"] for item in (customers, equipment, orders, maintenance)
    ]
    for source in (asset, order, service):
        _attach(workspace, source)
    customer_orders = _relationship(workspace, customer, order, "customer_id", "buyer")
    # Equipment is the right endpoint to exercise both relationship directions.
    equipment_maintenance = _relationship(workspace, service, asset, "equipment_ref", "asset_tag")
    return {
        "workspace": workspace,
        "other_workspace": equipment["workspace"]["workspace_id"],
        "order_source": order,
        "customer": {
            "display_name": "Customer", "source_id": customer, "record_key_field": "customer_id",
            "display_field": "name", "relationship_ids": [customer_orders],
        },
        "equipment": {
            "display_name": "Equipment", "source_id": asset, "record_key_field": "asset_tag",
            "display_field": "title", "relationship_ids": [equipment_maintenance],
        },
    }


def test_two_definitions_reload_with_stable_identity_and_workspace_scope(model, monkeypatch):
    workspace = model["workspace"]
    original_workspace = get_workspace(workspace)
    definitions = [business_objects.create_business_object(workspace, model[kind])
                   for kind in ("customer", "equipment")]
    assert len({item["object_id"] for item in definitions}) == 2
    assert get_workspace(workspace) == original_workspace

    monkeypatch.setattr(backend_db, "_SCHEMA_READY", False)
    assert business_objects.list_business_objects(workspace) == definitions
    for definition, kind in zip(definitions, ("customer", "equipment")):
        assert business_objects.get_business_object(workspace, definition["object_id"]) == definition
        assert definition["workspace_id"] == workspace
        assert definition["configuration_error"] is None
        assert {key: definition[key] for key in model[kind]} == model[kind]

    assert business_objects.list_business_objects(model["other_workspace"]) == []
    with pytest.raises(business_objects.BusinessObjectError) as caught:
        business_objects.get_business_object(model["other_workspace"], definitions[0]["object_id"])
    assert caught.value.code == "business_object_not_found"


def test_invalid_references_leave_no_definitions(model):
    workspace = model["workspace"]
    unrelated = model["equipment"]["relationship_ids"]
    cases = [
        ({"record_key_field": "missing"}, "source_field_not_found"),
        ({"display_field": "missing"}, "source_field_not_found"),
        ({"source_id": "missing"}, "source_not_found"),
        ({"relationship_ids": unrelated}, "relationship_not_applicable"),
        ({"relationship_ids": [unrelated[0], unrelated[0]]}, "invalid_definition"),
    ]
    for overrides, code in cases:
        with pytest.raises(business_objects.BusinessObjectError) as caught:
            business_objects.create_business_object(workspace, {**model["customer"], **overrides})
        assert caught.value.code == code

    other = model["other_workspace"]
    with pytest.raises(business_objects.BusinessObjectError) as caught:
        business_objects.create_business_object(other, model["customer"])
    assert caught.value.code == "source_not_in_workspace"
    with pytest.raises(business_objects.BusinessObjectError) as caught:
        business_objects.create_business_object(other, model["equipment"])
    assert caught.value.code == "relationship_not_found"
    assert business_objects.list_business_objects(workspace) == []
    assert business_objects.list_business_objects(other) == []


def test_failed_database_write_rolls_back_even_after_insert(model):
    workspace = model["workspace"]
    existing = business_objects.create_business_object(workspace, model["customer"])
    # SQLite RAISE(FAIL) keeps the statement's changes until the transaction rolls back.
    with closing(backend_db.get_db_connection()) as conn, conn:
        conn.execute("""
            CREATE TRIGGER reject_object AFTER INSERT ON workspace_business_objects
            BEGIN SELECT RAISE(FAIL, 'test write failure'); END
        """)
    with pytest.raises(sqlite3.IntegrityError, match="test write failure"):
        business_objects.create_business_object(workspace, model["equipment"])
    assert business_objects.list_business_objects(workspace) == [existing]


def test_changed_schema_and_deleted_relationship_keep_saved_definitions_visible(model):
    workspace = model["workspace"]
    customer = business_objects.create_business_object(workspace, model["customer"])
    equipment = business_objects.create_business_object(workspace, model["equipment"])
    with closing(backend_db.get_db_connection()) as conn, conn:
        conn.execute(
            "UPDATE datahub_datasets SET schema_json = ?, schema_version = schema_version + 1 WHERE id = ?",
            ('[{"name":"customer_id"}]', customer["source_id"]),
        )
    source_relationships.delete_relationship(workspace, equipment["relationship_ids"][0])
    reloaded = business_objects.list_business_objects(workspace)
    assert [item["object_id"] for item in reloaded] == [customer["object_id"], equipment["object_id"]]
    assert [item["configuration_error"]["code"] for item in reloaded] == [
        "source_field_not_found", "relationship_not_found",
    ]
    assert reloaded[1]["relationship_ids"] == equipment["relationship_ids"]


def test_unavailable_managed_source_is_rejected_and_reports_on_reload(model):
    workspace = model["workspace"]
    definition = business_objects.create_business_object(workspace, model["customer"])
    path = Path(get_source_private_locator(model["order_source"])["path"])
    path.unlink()

    with pytest.raises(business_objects.BusinessObjectError) as caught:
        business_objects.create_business_object(workspace, model["customer"])
    assert caught.value.code == "managed_source_unavailable"
    reloaded = business_objects.get_business_object(workspace, definition["object_id"])
    assert reloaded["configuration_error"]["code"] == "managed_source_unavailable"
    assert str(path) not in reloaded["configuration_error"]["message"]
    assert business_objects.list_business_objects(workspace) == [reloaded]


def test_reload_checks_current_relationship_fields_and_missing_catalog_source(model):
    workspace = model["workspace"]
    definition = business_objects.create_business_object(workspace, model["customer"])
    with closing(backend_db.get_db_connection()) as conn, conn:
        conn.execute(
            "UPDATE datahub_datasets SET schema_json = ?, schema_version = schema_version + 1 WHERE id = ?",
            ('[{"name":"buyer"}]', model["order_source"]),
        )
    assert business_objects.get_business_object(workspace, definition["object_id"]) == definition

    with closing(backend_db.get_db_connection()) as conn, conn:
        conn.execute(
            "UPDATE datahub_datasets SET schema_json = ? WHERE id = ?",
            ('[{"name":"total"}]', model["order_source"]),
        )
    reloaded = business_objects.get_business_object(workspace, definition["object_id"])
    assert reloaded["configuration_error"]["code"] == "relationship_field_not_found"

    # Simulate a catalog change outside the guarded source deletion route.
    with closing(backend_db.get_db_connection()) as conn, conn:
        conn.execute("DELETE FROM datahub_datasets WHERE id = ?", (definition["source_id"],))
    reloaded = business_objects.get_business_object(workspace, definition["object_id"])
    assert reloaded["configuration_error"]["code"] == "source_not_found"
    assert {**reloaded, "configuration_error": None} == definition


def _collection_url(workspace: str) -> str:
    return f"/api/data-workspaces/{workspace}/business-objects"


def test_definition_routes_create_list_and_get_both_configurations(client, model, monkeypatch):
    url = _collection_url(model["workspace"])
    assert client.get(url).get_json() == {"business_objects": []}

    definitions = []
    for kind in ("customer", "equipment"):
        response = client.post(url, json=model[kind])
        assert response.status_code == 201
        saved = response.get_json()["business_object"]
        assert set(saved) == {
            "contract_version", "object_id", "workspace_id", "display_name", "source_id",
            "record_key_field", "display_field", "relationship_ids", "created_at", "configuration_error",
        }
        assert saved["contract_version"] == "business_object_definition_v1"
        assert saved["workspace_id"] == model["workspace"]
        assert saved["configuration_error"] is None
        assert {key: saved[key] for key in model[kind]} == model[kind]
        definitions.append(saved)

    monkeypatch.setattr(backend_db, "_SCHEMA_READY", False)
    response = client.get(url)
    assert response.status_code == 200
    assert response.get_json() == {"business_objects": definitions}
    other_url = _collection_url(model["other_workspace"])
    assert client.get(other_url).get_json() == {"business_objects": []}
    for saved in definitions:
        response = client.get(f"{url}/{saved['object_id']}")
        assert response.status_code == 200
        assert response.get_json() == {"business_object": saved}
        other_response = client.get(f"{other_url}/{saved['object_id']}")
        assert other_response.status_code == 404
        assert other_response.get_json()["error"]["code"] == "business_object_not_found"


def test_definition_routes_return_structured_errors_without_writing(client, model):
    url = _collection_url(model["workspace"])
    other_url = _collection_url(model["other_workspace"])
    customer = model["customer"]
    cases = [
        (client.post(url, data="{", content_type="application/json"), 400, "invalid_request"),
        (client.post(url, json=[]), 400, "invalid_request"),
        (client.post(url, json={**customer, "workspace_id": "spoofed"}), 400, "invalid_request"),
        (client.post(url, json={**customer, "display_name": " "}), 400, "invalid_definition"),
        (client.post(url, json={**customer, "relationship_ids": [None]}), 400, "invalid_definition"),
        (client.get(_collection_url("missing")), 404, "workspace_not_found"),
        (client.post(url, json={**customer, "source_id": "missing"}), 404, "source_not_found"),
        (client.post(other_url, json=model["equipment"]), 404, "relationship_not_found"),
        (client.post(other_url, json=customer), 409, "source_not_in_workspace"),
        (client.post(url, json={**customer, "record_key_field": "missing"}), 409, "source_field_not_found"),
        (client.post(url, json={**customer, "relationship_ids": model["equipment"]["relationship_ids"]}),
         409, "relationship_not_applicable"),
    ]
    for response, status, code in cases:
        assert response.status_code == status
        error = response.get_json()["error"]
        assert error == {"code": code, "message": error["message"]}

    assert client.get(url).get_json() == {"business_objects": []}
    assert client.get(other_url).get_json() == {"business_objects": []}


def test_definition_route_keeps_configuration_when_schema_changes(client, model):
    url = _collection_url(model["workspace"])
    payload = {**model["customer"], "display_name": "  Customer  ", "relationship_ids": []}
    del payload["display_field"]
    response = client.post(url, json=payload)
    assert response.status_code == 201
    definition = response.get_json()["business_object"]
    assert definition["display_name"] == "Customer"
    assert definition["display_field"] is None
    assert definition["relationship_ids"] == []

    with closing(backend_db.get_db_connection()) as conn, conn:
        conn.execute("UPDATE datahub_datasets SET schema_json = '[]' WHERE id = ?", (definition["source_id"],))
    response = client.get(f"{url}/{definition['object_id']}")
    assert response.status_code == 200
    reloaded = response.get_json()["business_object"]
    assert reloaded["configuration_error"]["code"] == "source_schema_unavailable"
    assert {**reloaded, "configuration_error": None} == definition
    assert client.get(url).get_json() == {"business_objects": [reloaded]}


def test_definition_route_masks_storage_errors_and_preserves_existing_rows(client, model):
    url = _collection_url(model["workspace"])
    created = client.post(url, json=model["customer"])
    assert created.status_code == 201
    with closing(backend_db.get_db_connection()) as conn, conn:
        conn.execute("""
            CREATE TRIGGER reject_object AFTER INSERT ON workspace_business_objects
            BEGIN SELECT RAISE(FAIL, 'private failure detail'); END
        """)
    response = client.post(url, json=model["equipment"])
    assert response.status_code == 500
    assert response.get_json() == {"error": {
        "code": "business_object_storage_error", "message": "Business Object storage is unavailable."
    }}
    assert client.get(url).get_json() == {"business_objects": [created.get_json()["business_object"]]}
