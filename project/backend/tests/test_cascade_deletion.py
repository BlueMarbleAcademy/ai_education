"""Tests for Plan 1: Cascade Deletion."""
import uuid


class TestCascadeDeletion:

    def test_delete_empty_folder(self, client, auth_headers, create_folder):
        folder = create_folder("Empty Folder")
        resp = client.delete(f"/folders/{folder['id']}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["soft_deleted_items"] == 0
        assert data["soft_deleted_subfolders"] == 0

    def test_delete_folder_unlinks_items(self, client, auth_headers, create_folder, create_item):
        folder = create_folder("With Items")
        for i in range(3):
            create_item(content_type="quiz", folder_id=folder["id"], title=f"Quiz {i}")

        resp = client.delete(f"/folders/{folder['id']}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["soft_deleted_items"] == 3

    def test_delete_folder_cascades_subfolders(self, client, auth_headers, create_folder):
        root = create_folder("Root")
        child = create_folder("Child", parent_id=root["id"])
        grandchild = create_folder("Grandchild", parent_id=child["id"])

        resp = client.delete(f"/folders/{root['id']}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["soft_deleted_subfolders"] == 2

        # All should be soft-deleted (hidden from listing)
        list_resp = client.get("/folders", headers=auth_headers)
        folder_ids = [f["id"] for f in list_resp.json()]
        assert root["id"] not in folder_ids
        assert child["id"] not in folder_ids
        assert grandchild["id"] not in folder_ids

    def test_delete_cascade_unlinks_nested_items(self, client, auth_headers, create_folder, create_item):
        root = create_folder("Root")
        child = create_folder("Child", parent_id=root["id"])
        create_item(content_type="quiz", folder_id=root["id"], title="Root Item")
        create_item(content_type="flashcard_deck", folder_id=child["id"], title="Child Item")

        resp = client.delete(f"/folders/{root['id']}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["soft_deleted_items"] == 2

    def test_delete_no_cascade_with_children_returns_409(self, client, auth_headers, create_folder):
        root = create_folder("Root")
        create_folder("Child", parent_id=root["id"])

        resp = client.delete(
            f"/folders/{root['id']}",
            params={"cascade": "false"},
            headers=auth_headers,
        )
        assert resp.status_code == 409

    def test_delete_no_cascade_empty_folder_succeeds(self, client, auth_headers, create_folder):
        folder = create_folder("Lonely")
        resp = client.delete(
            f"/folders/{folder['id']}",
            params={"cascade": "false"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_delete_nonexistent_folder_returns_error(self, client, auth_headers):
        fake_id = str(uuid.uuid4())
        resp = client.delete(f"/folders/{fake_id}", headers=auth_headers)
        assert resp.status_code in (404, 500)
