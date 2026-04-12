"""Unit tests for LocalContainer.query_items parity with Cosmos SQL used by workspace/trash APIs."""
import tempfile
import uuid

import pytest

from main import LocalContainer


@pytest.fixture
def local_store():
    root = tempfile.mkdtemp()
    yield LocalContainer(root)


def _user_item(uid: str, **kwargs):
    doc = {
        "id": str(uuid.uuid4()),
        "userId": uid,
        "contentType": "note",
        "createdAt": "2024-01-02T00:00:00",
    }
    doc.update(kwargs)
    return doc


def test_local_container_unfiled_excludes_folder_and_filed_and_deleted(local_store):
    uid = "user-a"
    folder = _user_item(uid, contentType="folder", data={"name": "F"})
    filed = _user_item(uid, contentType="note", folderId=folder["id"])
    unfiled = _user_item(uid, contentType="note")
    deleted = _user_item(uid, contentType="note", deleted=True)

    for d in (folder, filed, unfiled, deleted):
        local_store.create_item(d)

    q = (
        "SELECT * FROM c WHERE c.userId = @userId AND c.contentType != 'folder' "
        "AND (NOT IS_DEFINED(c.folderId) OR IS_NULL(c.folderId)) "
        "AND (NOT IS_DEFINED(c.deleted) OR c.deleted = false) ORDER BY c.createdAt DESC"
    )
    rows = list(
        local_store.query_items(
            query=q,
            parameters=[{"name": "@userId", "value": uid}],
        )
    )
    assert len(rows) == 1
    assert rows[0]["id"] == unfiled["id"]


def test_local_container_trash_only_deleted(local_store):
    uid = "user-b"
    active = _user_item(uid, contentType="note")
    trashed = _user_item(uid, contentType="note", deleted=True, deletedAt="2024-02-01T00:00:00")
    for d in (active, trashed):
        local_store.create_item(d)

    q = "SELECT * FROM c WHERE c.userId = @userId AND c.deleted = true ORDER BY c.deletedAt DESC"
    rows = list(
        local_store.query_items(
            query=q,
            parameters=[{"name": "@userId", "value": uid}],
        )
    )
    assert len(rows) == 1
    assert rows[0]["id"] == trashed["id"]


def test_local_container_descendant_folders(local_store):
    uid = "user-c"
    root_folder = _user_item(uid, contentType="folder", data={"name": "Root", "parentFolderId": None})
    child = _user_item(
        uid,
        contentType="folder",
        data={"name": "Child", "parentFolderId": root_folder["id"]},
    )
    other = _user_item(
        uid,
        contentType="folder",
        data={"name": "Other", "parentFolderId": None},
    )
    for d in (root_folder, child, other):
        local_store.create_item(d)

    q = (
        "SELECT c.id FROM c WHERE c.userId = @userId AND c.contentType = 'folder' "
        "AND c.data.parentFolderId = @parentId"
    )
    rows = list(
        local_store.query_items(
            query=q,
            parameters=[
                {"name": "@userId", "value": uid},
                {"name": "@parentId", "value": root_folder["id"]},
            ],
        )
    )
    assert rows == [{"id": child["id"]}]


def test_local_container_trash_batch(local_store):
    uid = "user-d"
    batch = "batch-xyz"
    a = _user_item(uid, contentType="note", deleted=True, deletedBatchId=batch)
    b = _user_item(uid, contentType="note", deleted=True, deletedBatchId="other")
    for d in (a, b):
        local_store.create_item(d)

    q = (
        "SELECT * FROM c WHERE c.userId = @userId AND c.deletedBatchId = @batchId AND c.deleted = true"
    )
    rows = list(
        local_store.query_items(
            query=q,
            parameters=[
                {"name": "@userId", "value": uid},
                {"name": "@batchId", "value": batch},
            ],
        )
    )
    assert len(rows) == 1
    assert rows[0]["id"] == a["id"]


def test_local_container_list_folders_excludes_deleted(local_store):
    uid = "user-e"
    active = _user_item(uid, contentType="folder", data={"name": "A"})
    gone = _user_item(uid, contentType="folder", data={"name": "B"}, deleted=True)
    for d in (active, gone):
        local_store.create_item(d)

    q = (
        "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'folder' "
        "AND (NOT IS_DEFINED(c.deleted) OR c.deleted = false) ORDER BY c.createdAt DESC"
    )
    rows = list(
        local_store.query_items(
            query=q,
            parameters=[{"name": "@userId", "value": uid}],
        )
    )
    assert len(rows) == 1
    assert rows[0]["id"] == active["id"]
