"""Tests for Plan 6: Unfiled Items endpoint."""


class TestUnfiledItems:

    def test_unfiled_returns_items_without_folder(self, client, auth_headers, create_folder, create_item):
        folder = create_folder("Filed Folder")
        create_item(content_type="quiz", folder_id=folder["id"], title="Filed Quiz")
        create_item(content_type="quiz", folder_id=None, title="Unfiled Quiz")

        resp = client.get("/items/unfiled", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json()
        titles = [i["title"] for i in items]
        assert "Unfiled Quiz" in titles
        assert "Filed Quiz" not in titles

    def test_unfiled_excludes_folders(self, client, auth_headers, create_folder):
        create_folder("Should Not Appear")

        resp = client.get("/items/unfiled", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json()
        # Folders should never appear in unfiled items
        assert not any(i.get("contentType") == "folder" for i in items)

    def test_unfiled_filters_by_content_type(self, client, auth_headers, create_item):
        create_item(content_type="quiz", title="Unfiled Quiz")
        create_item(content_type="flashcard_deck", title="Unfiled Deck")
        create_item(content_type="summary", title="Unfiled Summary")

        resp = client.get("/items/unfiled", params={"content_type": "quiz"}, headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1
        assert items[0]["contentType"] == "quiz"

    def test_unfiled_excludes_deleted(self, client, auth_headers, create_item, mock_container):
        item = create_item(content_type="quiz", title="Soon Deleted")
        item_id = item["id"]

        # Manually soft-delete it in the mock store
        doc = mock_container._store[item_id]
        doc["deleted"] = True
        doc["deletedAt"] = "2024-01-01T00:00:00"

        resp = client.get("/items/unfiled", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json()
        assert not any(i["id"] == item_id for i in items)

    def test_unfiled_empty_when_all_filed(self, client, auth_headers, create_folder, create_item):
        folder = create_folder("Container")
        create_item(content_type="quiz", folder_id=folder["id"], title="Filed")

        resp = client.get("/items/unfiled", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_route_ordering_unfiled_not_captured_as_item_id(self, client, auth_headers):
        """Ensure GET /items/unfiled hits the list endpoint, not GET /items/{item_id}."""
        resp = client.get("/items/unfiled", headers=auth_headers)
        # Should return 200 with a list, not 404 (which would happen if "unfiled" was treated as an ID)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
