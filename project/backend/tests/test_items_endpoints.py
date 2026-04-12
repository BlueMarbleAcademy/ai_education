"""Tests for Plan 3: Items endpoints (GET /items/{id}, move, folder items filtering)."""
import uuid


class TestGetItem:

    def test_get_item_by_id(self, client, auth_headers, create_item, create_folder):
        folder = create_folder("Holder")
        item_resp = create_item(content_type="mindmap", folder_id=folder["id"], title="My Map")
        item_id = item_resp["id"]

        resp = client.get(f"/items/{item_id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == item_id
        assert data["title"] == "My Map"
        assert data["contentType"] == "mindmap"

    def test_get_item_wrong_user_returns_403(self, client, auth_headers, auth_headers_user_b, create_item, create_folder):
        folder = create_folder("Private")
        item_resp = create_item(content_type="quiz", folder_id=folder["id"], title="Secret")
        item_id = item_resp["id"]

        # User B tries to access User A's item
        resp = client.get(f"/items/{item_id}", headers=auth_headers_user_b)
        assert resp.status_code in (403, 404)

    def test_get_item_not_found_returns_404(self, client, auth_headers):
        fake_id = str(uuid.uuid4())
        resp = client.get(f"/items/{fake_id}", headers=auth_headers)
        assert resp.status_code == 404


class TestMoveItem:

    def test_move_item_to_folder(self, client, auth_headers, create_folder, create_item):
        folder_a = create_folder("A")
        folder_b = create_folder("B")
        item = create_item(content_type="quiz", folder_id=folder_a["id"], title="Movable")
        item_id = item["id"]

        resp = client.patch(
            f"/items/{item_id}/move",
            json={"folder_id": folder_b["id"]},
            headers=auth_headers,
        )
        assert resp.status_code == 200

        # Verify item is in folder B
        items_resp = client.get(f"/folders/{folder_b['id']}/items", headers=auth_headers)
        assert any(i["id"] == item_id for i in items_resp.json())

        # Verify item is NOT in folder A
        items_a = client.get(f"/folders/{folder_a['id']}/items", headers=auth_headers)
        assert not any(i["id"] == item_id for i in items_a.json())

    def test_move_item_to_null_unfiles(self, client, auth_headers, create_folder, create_item):
        folder = create_folder("Source")
        item = create_item(content_type="quiz", folder_id=folder["id"], title="To Unfile")
        item_id = item["id"]

        resp = client.patch(
            f"/items/{item_id}/move",
            json={"folder_id": None},
            headers=auth_headers,
        )
        assert resp.status_code == 200

        # Verify item is now unfiled
        unfiled = client.get("/items/unfiled", headers=auth_headers)
        assert any(i["id"] == item_id for i in unfiled.json())


class TestFolderItemsFiltering:

    def test_get_folder_items_filters_by_type(self, client, auth_headers, create_folder, create_item):
        folder = create_folder("Mixed")
        create_item(content_type="quiz", folder_id=folder["id"], title="Quiz 1")
        create_item(content_type="flashcard_deck", folder_id=folder["id"], title="Deck 1")
        create_item(content_type="quiz", folder_id=folder["id"], title="Quiz 2")

        resp = client.get(
            f"/folders/{folder['id']}/items",
            params={"content_type": "quiz"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 2
        assert all(i["contentType"] == "quiz" for i in items)

    def test_mindmap_click_route_data(self, client, auth_headers, create_folder, create_item):
        folder = create_folder("Maps")
        item = create_item(
            content_type="mindmap",
            folder_id=folder["id"],
            title="Flow Chart",
            data={"nodes": [], "edges": []},
        )
        item_id = item["id"]

        resp = client.get(f"/items/{item_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["contentType"] == "mindmap"

    def test_summary_click_route_data(self, client, auth_headers, create_folder, create_item):
        folder = create_folder("Summaries")
        item = create_item(
            content_type="summary",
            folder_id=folder["id"],
            title="Chapter 1 Summary",
            data={"summary": "This is a summary of chapter 1..."},
        )
        item_id = item["id"]

        resp = client.get(f"/items/{item_id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["contentType"] == "summary"
        assert "summary" in data["data"]
