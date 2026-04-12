"""Tests for Plan 8: Soft-Delete Trash mechanism."""
import time


class TestSoftDelete:

    def test_soft_delete_folder_marks_deleted(self, client, auth_headers, create_folder):
        folder = create_folder("To Delete")
        client.delete(f"/folders/{folder['id']}", headers=auth_headers)

        trash_resp = client.get("/trash", headers=auth_headers)
        assert trash_resp.status_code == 200
        trashed = trash_resp.json()
        folder_in_trash = next((i for i in trashed if i["id"] == folder["id"]), None)
        assert folder_in_trash is not None
        assert folder_in_trash["deleted"] is True
        assert "deletedAt" in folder_in_trash

    def test_soft_deleted_folder_hidden_from_list(self, client, auth_headers, create_folder):
        folder = create_folder("Invisible")
        client.delete(f"/folders/{folder['id']}", headers=auth_headers)

        list_resp = client.get("/folders", headers=auth_headers)
        folder_ids = [f["id"] for f in list_resp.json()]
        assert folder["id"] not in folder_ids

    def test_soft_deleted_items_hidden_from_folder(self, client, auth_headers, create_folder, create_item, mock_container):
        folder = create_folder("Folder With Items")
        item = create_item(content_type="quiz", folder_id=folder["id"], title="Hidden Item")
        item_id = item["id"]

        # Soft-delete the item directly
        doc = mock_container._store[item_id]
        doc["deleted"] = True
        doc["deletedAt"] = "2024-01-01T00:00:00"

        items_resp = client.get(f"/folders/{folder['id']}/items", headers=auth_headers)
        assert items_resp.status_code == 200
        assert not any(i["id"] == item_id for i in items_resp.json())

    def test_cascade_soft_delete_sets_batch_id(self, client, auth_headers, create_folder, create_item, mock_container):
        root = create_folder("Root")
        child = create_folder("Child", parent_id=root["id"])
        item1 = create_item(content_type="quiz", folder_id=root["id"], title="Root Item")
        item2 = create_item(content_type="quiz", folder_id=child["id"], title="Child Item")

        client.delete(f"/folders/{root['id']}", headers=auth_headers)

        # All should share the same deletedBatchId
        root_doc = mock_container._store[root["id"]]
        child_doc = mock_container._store[child["id"]]
        item1_doc = mock_container._store[item1["id"]]
        item2_doc = mock_container._store[item2["id"]]

        batch_id = root_doc.get("deletedBatchId")
        assert batch_id is not None
        assert child_doc.get("deletedBatchId") == batch_id
        assert item1_doc.get("deletedBatchId") == batch_id
        assert item2_doc.get("deletedBatchId") == batch_id


class TestRestore:

    def test_restore_folder_restores_batch(self, client, auth_headers, create_folder, create_item):
        folder = create_folder("Restore Me")
        create_item(content_type="quiz", folder_id=folder["id"], title="Batch Item")

        # Soft-delete
        client.delete(f"/folders/{folder['id']}", headers=auth_headers)

        # Restore
        resp = client.post(f"/trash/{folder['id']}/restore", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["restored_count"] >= 2

        # Folder should be back in listings
        list_resp = client.get("/folders", headers=auth_headers)
        assert any(f["id"] == folder["id"] for f in list_resp.json())

    def test_restore_item_only(self, client, auth_headers, create_folder, create_item, mock_container):
        folder = create_folder("Holder")
        item = create_item(content_type="quiz", folder_id=folder["id"], title="Restoring Item")
        item_id = item["id"]

        # Soft-delete just the item
        doc = mock_container._store[item_id]
        doc["deleted"] = True
        doc["deletedAt"] = "2024-01-01T00:00:00"

        # Restore
        resp = client.post(f"/trash/{item_id}/restore", headers=auth_headers)
        assert resp.status_code == 200

        # Item should be back in folder
        items_resp = client.get(f"/folders/{folder['id']}/items", headers=auth_headers)
        assert any(i["id"] == item_id for i in items_resp.json())


class TestPermanentDelete:

    def test_permanent_delete_single(self, client, auth_headers, create_item, mock_container):
        item = create_item(content_type="quiz", title="Permanent Delete")
        item_id = item["id"]

        # Soft-delete
        doc = mock_container._store[item_id]
        doc["deleted"] = True
        doc["deletedAt"] = "2024-01-01T00:00:00"

        # Permanently delete
        resp = client.delete(f"/trash/{item_id}", headers=auth_headers)
        assert resp.status_code == 200

        # Should be gone from store entirely
        assert item_id not in mock_container._store

        # Should be gone from trash
        trash_resp = client.get("/trash", headers=auth_headers)
        assert not any(i["id"] == item_id for i in trash_resp.json())

    def test_permanent_delete_folder_cascades(self, client, auth_headers, create_folder, create_item, mock_container):
        folder = create_folder("Perm Delete Folder")
        item = create_item(content_type="quiz", folder_id=folder["id"], title="Perm Item")

        # Soft-delete via API (sets batchId)
        client.delete(f"/folders/{folder['id']}", headers=auth_headers)

        # Now permanently delete the folder from trash
        resp = client.delete(f"/trash/{folder['id']}", headers=auth_headers)
        assert resp.status_code == 200

        # Both folder and item should be gone
        assert folder["id"] not in mock_container._store
        assert item["id"] not in mock_container._store

    def test_empty_trash(self, client, auth_headers, create_item, mock_container):
        # Create and soft-delete several items
        ids = []
        for i in range(3):
            item = create_item(content_type="quiz", title=f"Trash Item {i}")
            doc = mock_container._store[item["id"]]
            doc["deleted"] = True
            doc["deletedAt"] = "2024-01-01T00:00:00"
            ids.append(item["id"])

        resp = client.delete("/trash", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["deleted_count"] == 3

        # Trash should be empty
        trash_resp = client.get("/trash", headers=auth_headers)
        assert trash_resp.json() == []


class TestTrashEdgeCases:

    def test_restore_folder_with_deleted_parent(self, client, auth_headers, create_folder, mock_container):
        parent = create_folder("Parent")
        child = create_folder("Child", parent_id=parent["id"])

        # Soft-delete both (separately)
        client.delete(f"/folders/{parent['id']}", headers=auth_headers)
        # Child was cascade-deleted with parent, try to restore child
        resp = client.post(f"/trash/{child['id']}/restore", headers=auth_headers)
        assert resp.status_code == 200

    def test_trash_ordered_by_deleted_at(self, client, auth_headers, create_item, mock_container):
        item1 = create_item(content_type="quiz", title="First")
        item2 = create_item(content_type="quiz", title="Second")
        item3 = create_item(content_type="quiz", title="Third")

        # Delete them with staggered timestamps
        mock_container._store[item1["id"]]["deleted"] = True
        mock_container._store[item1["id"]]["deletedAt"] = "2024-01-01T00:00:00"
        mock_container._store[item2["id"]]["deleted"] = True
        mock_container._store[item2["id"]]["deletedAt"] = "2024-01-03T00:00:00"
        mock_container._store[item3["id"]]["deleted"] = True
        mock_container._store[item3["id"]]["deletedAt"] = "2024-01-02T00:00:00"

        resp = client.get("/trash", headers=auth_headers)
        items = resp.json()
        # Should be ordered newest first: Second, Third, First
        assert items[0]["title"] == "Second"
        assert items[1]["title"] == "Third"
        assert items[2]["title"] == "First"
