import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { mockApiFetch, renderWithRouter, makeMockItem } from "../../test/helpers";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import TrashPage from "../Trash";

function makeTrashItem(overrides = {}) {
  const contentType = overrides.contentType || "quiz";
  const title = overrides.title || "Test Item";
  return {
    ...makeMockItem({
      contentType,
      data: { title, ...(overrides.data || {}) },
      ...overrides,
    }),
    deleted: true,
    deletedAt: overrides.deletedAt || new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

describe("Trash Page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("renders trashed items", async () => {
    const items = [
      makeTrashItem({ id: "t1", title: "Deleted Quiz", contentType: "quiz" }),
      makeTrashItem({ id: "t2", title: "Deleted Summary", contentType: "summary" }),
    ];
    mockApiFetch("/trash", items);

    renderWithRouter(<TrashPage />);
    await waitFor(() => {
      expect(screen.getByText("Deleted Quiz")).toBeInTheDocument();
      expect(screen.getByText("Deleted Summary")).toBeInTheDocument();
    });
  });

  it("empty state shows 'Trash is empty'", async () => {
    mockApiFetch("/trash", []);

    renderWithRouter(<TrashPage />);
    await waitFor(() => {
      expect(screen.getByText("Trash is empty")).toBeInTheDocument();
    });
  });

  it("restore calls POST /trash/{id}/restore", async () => {
    const item = makeTrashItem({ id: "restore-me", title: "Restorable" });

    global.fetch.mockImplementation(async (url, opts) => {
      if (opts?.method === "POST" && url.includes("/trash/restore-me/restore")) {
        return { ok: true, status: 200, json: async () => ({ message: "Restored", restored_count: 1 }) };
      }
      if (url.includes("/trash")) return { ok: true, status: 200, json: async () => [item] };
      return { ok: true, status: 200, json: async () => [] };
    });

    renderWithRouter(<TrashPage />);
    await waitFor(() => expect(screen.getByText("Restorable")).toBeInTheDocument());

    // Click "Restore" button
    fireEvent.click(screen.getByText("Restore"));

    await waitFor(() => {
      const postCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => typeof url === "string" && url.includes("/trash/restore-me/restore") && opts?.method === "POST"
      );
      expect(postCalls.length).toBe(1);
    });
  });

  it("permanent delete shows confirm then calls DELETE", async () => {
    const item = makeTrashItem({ id: "perm-del", title: "Gone Forever" });

    global.fetch.mockImplementation(async (url, opts) => {
      if (opts?.method === "DELETE" && typeof url === "string" && url.includes("/trash/perm-del")) {
        return { ok: true, status: 200, json: async () => ({ message: "Deleted", deleted_count: 1 }) };
      }
      if (typeof url === "string" && url.includes("/trash")) return { ok: true, status: 200, json: async () => [item] };
      return { ok: true, status: 200, json: async () => [] };
    });

    renderWithRouter(<TrashPage />);
    await waitFor(() => expect(screen.getByText("Gone Forever")).toBeInTheDocument());

    // "Delete" per-item button
    fireEvent.click(screen.getByText("Delete"));

    // Confirm
    await waitFor(() => expect(screen.getByText("Permanently delete?")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Delete Forever"));

    await waitFor(() => {
      const deleteCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => typeof url === "string" && url.includes("/trash/perm-del") && opts?.method === "DELETE"
      );
      expect(deleteCalls.length).toBe(1);
    });
  });

  it("empty trash shows confirm then calls DELETE /trash", async () => {
    const items = [makeTrashItem({ title: "Item 1" }), makeTrashItem({ title: "Item 2" })];

    global.fetch.mockImplementation(async (url, opts) => {
      if (opts?.method === "DELETE" && typeof url === "string" && url.endsWith("/trash")) {
        return { ok: true, status: 200, json: async () => ({ message: "Emptied", deleted_count: 2 }) };
      }
      if (typeof url === "string" && url.includes("/trash")) return { ok: true, status: 200, json: async () => items };
      return { ok: true, status: 200, json: async () => [] };
    });

    renderWithRouter(<TrashPage />);
    await waitFor(() => expect(screen.getByText("Empty Trash")).toBeInTheDocument());

    // Click "Empty Trash" button in header
    const emptyBtn = screen.getAllByText("Empty Trash")[0];
    fireEvent.click(emptyBtn);

    await waitFor(() => expect(screen.getByText("Empty Trash?")).toBeInTheDocument());
    // Confirm in the modal
    const confirmBtns = screen.getAllByText("Empty Trash");
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => {
      const deleteCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => typeof url === "string" && url.endsWith("/trash") && opts?.method === "DELETE"
      );
      expect(deleteCalls.length).toBe(1);
    });
  });

  it("displays time ago for deletedAt", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const item = makeTrashItem({ title: "Old Item", deletedAt: twoDaysAgo });
    mockApiFetch("/trash", [item]);

    renderWithRouter(<TrashPage />);
    await waitFor(() => {
      expect(screen.getByText("Old Item")).toBeInTheDocument();
      expect(screen.getByText(/Deleted 2d ago/)).toBeInTheDocument();
    });
  });
});
