"""Tests for Plan 4: Folder Starring System."""


class TestStarring:

    def test_star_folder(self, client, auth_headers, create_folder):
        folder = create_folder("Starrable")
        resp = client.patch(
            f"/folders/{folder['id']}",
            json={"starred": True},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["starred"] is True

    def test_unstar_folder(self, client, auth_headers, create_folder):
        folder = create_folder("Toggle")
        # Star it
        client.patch(f"/folders/{folder['id']}", json={"starred": True}, headers=auth_headers)
        # Unstar it
        resp = client.patch(f"/folders/{folder['id']}", json={"starred": False}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["starred"] is False

    def test_star_persists_across_list(self, client, auth_headers, create_folder):
        folder = create_folder("Persistent Star")
        client.patch(f"/folders/{folder['id']}", json={"starred": True}, headers=auth_headers)

        list_resp = client.get("/folders", headers=auth_headers)
        assert list_resp.status_code == 200
        target = next(f for f in list_resp.json() if f["id"] == folder["id"])
        assert target["starred"] is True

    def test_new_folder_defaults_unstarred(self, client, auth_headers, create_folder):
        folder = create_folder("New Folder")
        assert folder["starred"] is False

    def test_star_does_not_affect_other_fields(self, client, auth_headers, create_folder):
        folder = create_folder("Stable", color="from-green-100 to-lime-100")
        original_name = folder["name"]
        original_color = folder["color"]

        resp = client.patch(
            f"/folders/{folder['id']}",
            json={"starred": True},
            headers=auth_headers,
        )
        updated = resp.json()
        assert updated["name"] == original_name
        assert updated["color"] == original_color
        assert updated["parentFolderId"] == folder["parentFolderId"]
