"""
Test fixtures for workspace system backend tests.
Provides an in-memory mock Cosmos container and a pre-authenticated test client.
"""
import re
import time
import uuid
import pytest
from unittest.mock import patch
from jose import jwt
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# In-memory mock for Azure Cosmos DB container
# ---------------------------------------------------------------------------

class MockCosmosContainer:
    """Simulates azure.cosmos container operations with an in-memory dict store."""

    def __init__(self):
        self._store: dict[str, dict] = {}

    def reset(self):
        self._store.clear()

    def create_item(self, body: dict):
        doc_id = body.get("id") or str(uuid.uuid4())
        body["id"] = doc_id
        self._store[doc_id] = body
        return body

    def read_item(self, item: str, partition_key: str):
        doc = self._store.get(item)
        if not doc:
            from azure.cosmos.exceptions import CosmosResourceNotFoundError
            raise CosmosResourceNotFoundError(status_code=404, message="Not found")
        return doc

    def replace_item(self, item: str, body: dict, partition_key: str = None):
        self._store[item] = body
        return body

    def delete_item(self, item: str, partition_key: str):
        if item in self._store:
            del self._store[item]

    def query_items(self, query: str, parameters: list = None, enable_cross_partition_query: bool = True):
        """Minimal Cosmos SQL parser for tests -- handles WHERE filters."""
        params = {p["name"]: p["value"] for p in (parameters or [])}
        results = list(self._store.values())
        results = self._apply_filters(results, query, params)
        results = self._apply_ordering(results, query)
        return results

    def _apply_filters(self, items, query, params):
        filtered = items

        if "@userId" in params:
            filtered = [i for i in filtered if i.get("userId") == params["@userId"]]

        if "c.contentType = @contentType" in query and "@contentType" in params:
            filtered = [i for i in filtered if i.get("contentType") == params["@contentType"]]
        elif "c.contentType != 'folder'" in query:
            filtered = [i for i in filtered if i.get("contentType") != "folder"]
        elif "c.contentType = 'folder'" in query:
            filtered = [i for i in filtered if i.get("contentType") == "folder"]
        elif "c.contentType = 'mindmap'" in query:
            filtered = [i for i in filtered if i.get("contentType") == "mindmap"]

        if "@folderId" in params and "c.folderId = @folderId" in query:
            filtered = [i for i in filtered if i.get("folderId") == params["@folderId"]]

        if "c.data.parentFolderId = @parentId" in query and "@parentId" in params:
            filtered = [i for i in filtered if i.get("data", {}).get("parentFolderId") == params["@parentId"]]

        if "(NOT IS_DEFINED(c.folderId) OR IS_NULL(c.folderId))" in query:
            filtered = [i for i in filtered if not i.get("folderId")]

        if "(NOT IS_DEFINED(c.deleted) OR c.deleted = false)" in query:
            filtered = [i for i in filtered if not i.get("deleted")]

        if "c.deleted = true" in query:
            filtered = [i for i in filtered if i.get("deleted") is True]

        if "@batchId" in params and "c.deletedBatchId = @batchId" in query:
            filtered = [i for i in filtered if i.get("deletedBatchId") == params["@batchId"]]

        # SELECT c.id → return only id field
        if query.strip().startswith("SELECT c.id"):
            filtered = [{"id": i["id"]} for i in filtered]

        return filtered

    def _apply_ordering(self, items, query):
        if "ORDER BY c.createdAt DESC" in query:
            items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        elif "ORDER BY c.deletedAt DESC" in query:
            items.sort(key=lambda x: x.get("deletedAt", ""), reverse=True)
        return items


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_container():
    """Fresh in-memory container for each test."""
    return MockCosmosContainer()


@pytest.fixture
def client(mock_container):
    """
    FastAPI TestClient with the container patched to use our in-memory mock.
    Also patches database import used by main.py.
    """
    with patch("main.container", mock_container):
        from main import app
        with TestClient(app) as tc:
            yield tc


@pytest.fixture
def fake_token():
    """Generate a valid JWT that passes validate_token."""
    def _make(sub="test-user-123"):
        now = int(time.time())
        payload = {
            "sub": sub,
            "name": "testuser",
            "iat": now,
            "exp": now + 3600,
        }
        return jwt.encode(payload, key="development_key_not_for_production", algorithm="HS256")
    return _make


@pytest.fixture
def auth_headers(fake_token):
    """Convenience: returns dict with Authorization header for default test user."""
    return {"Authorization": f"Bearer {fake_token()}"}


@pytest.fixture
def auth_headers_user_b(fake_token):
    """Auth headers for a second user (for access control tests)."""
    return {"Authorization": f"Bearer {fake_token('test-user-b-456')}"}


@pytest.fixture
def create_folder(client, auth_headers):
    """Factory fixture: creates a folder and returns the response JSON."""
    def _create(name="Test Folder", color="from-indigo-100 to-indigo-200", parent_id=None):
        body = {"name": name, "color": color}
        if parent_id:
            body["parentFolderId"] = parent_id
        resp = client.post("/folders", json=body, headers=auth_headers)
        assert resp.status_code == 200
        return resp.json()
    return _create


@pytest.fixture
def create_item(client, auth_headers):
    """Factory fixture: creates an item via /save-to-folder and returns response JSON."""
    def _create(content_type="quiz", folder_id=None, title="Test Item", data=None):
        body = {
            "title": title,
            "contentType": content_type,
            "data": data or {},
        }
        if folder_id:
            body["folderId"] = folder_id
        resp = client.post("/save-to-folder", json=body, headers=auth_headers)
        assert resp.status_code == 200
        return resp.json()
    return _create
