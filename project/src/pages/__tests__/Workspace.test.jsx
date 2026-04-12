import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { mockApiFetch, renderWithRouter, makeMockFolder, makeMockItem, getFetchCalls } from "../../test/helpers";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import Workspace from "../Workspace";

function setupDefaultMocks(folders = [], unfiled = [], trash = []) {
  mockApiFetch("/folders", folders);
  mockApiFetch("/items/unfiled", unfiled);
  mockApiFetch("/trash", trash);
}

describe("Workspace", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("renders folder list on load", async () => {
    const folders = [makeMockFolder({ name: "Math Notes" }), makeMockFolder({ name: "Science" })];
    setupDefaultMocks(folders);

    renderWithRouter(<Workspace />);
    await waitFor(() => {
      expect(screen.getByText("Math Notes")).toBeInTheDocument();
      expect(screen.getByText("Science")).toBeInTheDocument();
    });
  });

  it("shows unfiled items card when count > 0", async () => {
    const unfiled = [makeMockItem(), makeMockItem(), makeMockItem()];
    setupDefaultMocks([], unfiled);

    renderWithRouter(<Workspace />);
    await waitFor(() => {
      expect(screen.getByText("Unfiled Items")).toBeInTheDocument();
      expect(screen.getByText(/3 items? not in any folder/)).toBeInTheDocument();
    });
  });

  it("hides unfiled card when count is 0", async () => {
    setupDefaultMocks([], []);

    renderWithRouter(<Workspace />);
    await waitFor(() => {
      expect(screen.queryByText("Unfiled Items")).not.toBeInTheDocument();
    });
  });

  it("shows trash card when count > 0", async () => {
    const trash = [makeMockItem({ deleted: true }), makeMockItem({ deleted: true })];
    setupDefaultMocks([], [], trash);

    renderWithRouter(<Workspace />);
    await waitFor(() => {
      expect(screen.getByText("Recently Deleted")).toBeInTheDocument();
      expect(screen.getByText(/2 items? in trash/)).toBeInTheDocument();
    });
  });

  it("star toggle calls PATCH and updates UI", async () => {
    const folder = makeMockFolder({ name: "Star Me", starred: false });
    setupDefaultMocks([folder]);

    global.fetch.mockImplementation(async (url, opts) => {
      if (url.includes(`/folders/${folder.id}`) && opts?.method === "PATCH") {
        return { ok: true, status: 200, json: async () => ({ ...folder, starred: true }) };
      }
      if (url.includes("/folders")) return { ok: true, status: 200, json: async () => [folder] };
      return { ok: true, status: 200, json: async () => [] };
    });

    renderWithRouter(<Workspace />);
    await waitFor(() => expect(screen.getByText("Star Me")).toBeInTheDocument());

    const starButtons = screen.getAllByTitle(/Star|Unstar/i);
    if (starButtons.length > 0) {
      fireEvent.click(starButtons[0]);
      await waitFor(() => {
        const patchCalls = getFetchCalls(`/folders/${folder.id}`);
        const patchCall = patchCalls.find(([, opts]) => opts?.method === "PATCH");
        expect(patchCall).toBeDefined();
      });
    }
  });

  it("unstar toggle calls PATCH with starred false", async () => {
    const folder = makeMockFolder({ name: "Was Starred", starred: true });
    setupDefaultMocks([folder]);

    global.fetch.mockImplementation(async (url, opts) => {
      if (url.includes(`/folders/${folder.id}`) && opts?.method === "PATCH") {
        const body = JSON.parse(opts.body || "{}");
        return { ok: true, status: 200, json: async () => ({ ...folder, starred: body.starred }) };
      }
      if (url.includes("/folders")) return { ok: true, status: 200, json: async () => [folder] };
      return { ok: true, status: 200, json: async () => [] };
    });

    renderWithRouter(<Workspace />);
    await waitFor(() => expect(screen.getByText("Was Starred")).toBeInTheDocument());

    fireEvent.click(screen.getByTitle("Unstar"));
    await waitFor(() => {
      const patchCalls = getFetchCalls(`/folders/${folder.id}`);
      const patchCall = patchCalls.find(([, opts]) => opts?.method === "PATCH");
      expect(patchCall).toBeDefined();
      expect(JSON.parse(patchCall[1].body).starred).toBe(false);
    });
  });

  it("move folder calls PATCH with parentFolderId", async () => {
    const folderA = makeMockFolder({ id: "folder-a", name: "Folder A" });
    const folderB = makeMockFolder({ id: "folder-b", name: "Folder B" });
    setupDefaultMocks([folderA, folderB]);

    global.fetch.mockImplementation(async (url, opts) => {
      if (String(url).includes("/folders/folder-a") && opts?.method === "PATCH") {
        return { ok: true, status: 200, json: async () => ({ ...folderA, parentFolderId: "folder-b" }) };
      }
      if (url.includes("/folders")) return { ok: true, status: 200, json: async () => [folderA, folderB] };
      return { ok: true, status: 200, json: async () => [] };
    });

    renderWithRouter(<Workspace />);
    await waitFor(() => expect(screen.getByText("Folder A")).toBeInTheDocument());

    const moveButtons = screen.getAllByTitle("Move folder");
    fireEvent.click(moveButtons[0]);
    await screen.findByText(/Move "Folder A"/);
    fireEvent.click(screen.getByRole("button", { name: /Folder B/ }));
    fireEvent.click(screen.getByRole("button", { name: "Move Here" }));

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([url, opts]) =>
          opts?.method === "PATCH" && String(url).includes("/folders/folder-a")
      );
      expect(patchCall).toBeDefined();
      expect(JSON.parse(patchCall[1].body).parentFolderId).toBe("folder-b");
    });
  });

  it("delete folder calls DELETE", async () => {
    const folder = makeMockFolder({ name: "Delete Me" });
    setupDefaultMocks([folder]);

    global.fetch.mockImplementation(async (url, opts) => {
      if (opts?.method === "DELETE") return { ok: true, status: 200, json: async () => ({ ok: true }) };
      if (url.includes("/folders")) return { ok: true, status: 200, json: async () => [folder] };
      return { ok: true, status: 200, json: async () => [] };
    });

    renderWithRouter(<Workspace />);
    await waitFor(() => expect(screen.getByText("Delete Me")).toBeInTheDocument());

    const deleteButtons = screen.getAllByTitle(/Delete/i);
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
      await waitFor(() => {
        expect(screen.getByText("Delete this folder?")).toBeInTheDocument();
      });
      const deleteNamed = screen.getAllByRole("button", { name: /^Delete$/ });
      const confirmBtn = deleteNamed.find((b) =>
        b.className.includes("from-rose-600")
      );
      expect(confirmBtn).toBeTruthy();
      fireEvent.click(confirmBtn);
      await waitFor(() => {
        const deleteCalls = global.fetch.mock.calls.filter(
          ([url, opts]) => opts?.method === "DELETE" && String(url).includes(`/folders/${folder.id}`)
        );
        expect(deleteCalls.length).toBeGreaterThan(0);
      });
    }
  });

  it("navigate to unfiled on card click", async () => {
    setupDefaultMocks([], [makeMockItem()]);

    renderWithRouter(<Workspace />);
    await waitFor(() => expect(screen.getByText("Unfiled Items")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Unfiled Items"));
    expect(mockNavigate).toHaveBeenCalledWith("/workspace/unfiled");
  });

  it("navigate to trash on card click", async () => {
    setupDefaultMocks([], [], [makeMockItem({ deleted: true })]);

    renderWithRouter(<Workspace />);
    await waitFor(() => expect(screen.getByText("Recently Deleted")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Recently Deleted"));
    expect(mockNavigate).toHaveBeenCalledWith("/workspace/trash");
  });
});
