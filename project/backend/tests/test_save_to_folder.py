"""Tests for Plan 2: Save to Folder endpoint."""


class TestSaveToFolder:

    def test_save_item_to_folder(self, client, auth_headers, create_folder):
        folder = create_folder("Target")
        resp = client.post("/save-to-folder", json={
            "title": "My Quiz",
            "contentType": "quiz",
            "folderId": folder["id"],
            "data": {"questions": []},
        }, headers=auth_headers)
        assert resp.status_code == 200

        # Verify item appears in folder items
        items_resp = client.get(f"/folders/{folder['id']}/items", headers=auth_headers)
        assert items_resp.status_code == 200
        items = items_resp.json()
        assert len(items) == 1
        assert items[0]["title"] == "My Quiz"
        assert items[0]["contentType"] == "quiz"

    def test_save_item_without_folder(self, client, auth_headers):
        resp = client.post("/save-to-folder", json={
            "title": "Orphan Note",
            "contentType": "note",
            "data": {},
        }, headers=auth_headers)
        assert resp.status_code == 200

        # Verify item appears in unfiled
        unfiled_resp = client.get("/items/unfiled", headers=auth_headers)
        assert unfiled_resp.status_code == 200
        items = unfiled_resp.json()
        assert any(i["title"] == "Orphan Note" for i in items)

    def test_save_item_returns_id(self, client, auth_headers):
        resp = client.post("/save-to-folder", json={
            "title": "Test",
            "contentType": "note",
            "data": {},
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert "message" in data
        assert len(data["id"]) > 0

    def test_save_item_default_content_type(self, client, auth_headers):
        resp = client.post("/save-to-folder", json={
            "title": "No Type Specified",
            "data": {},
        }, headers=auth_headers)
        assert resp.status_code == 200
        item_id = resp.json()["id"]

        # Fetch it back
        item_resp = client.get(f"/items/{item_id}", headers=auth_headers)
        assert item_resp.status_code == 200
        assert item_resp.json()["contentType"] == "note"

    def test_folder_item_count_updates_dynamically(self, client, auth_headers, create_folder):
        folder = create_folder("Counter Test")

        # Save 2 items
        client.post("/save-to-folder", json={
            "title": "Item 1", "contentType": "quiz", "folderId": folder["id"], "data": {},
        }, headers=auth_headers)
        client.post("/save-to-folder", json={
            "title": "Item 2", "contentType": "flashcard_deck", "folderId": folder["id"], "data": {},
        }, headers=auth_headers)

        # Check folder list reports correct count
        folders_resp = client.get("/folders", headers=auth_headers)
        assert folders_resp.status_code == 200
        target = next(f for f in folders_resp.json() if f["id"] == folder["id"])
        assert target["items"] == 2
