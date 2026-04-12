import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { mockApiFetch, makeMockFolder } from "../../test/helpers";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useSearchParams: () => [new URLSearchParams(""), vi.fn()] };
});

import SaveToFolderButton from "../SaveToFolderButton";

describe("SaveToFolderButton", () => {
  const folder = makeMockFolder({ id: "folder-save", name: "Save Here" });

  beforeEach(() => {
    mockApiFetch("/folders", [folder]);
    try { localStorage.clear(); } catch { /* noop if not available */ }
  });

  it("saves item via POST /save-to-folder", async () => {
    global.fetch.mockImplementation(async (url, opts) => {
      if (typeof url === "string" && url.includes("/save-to-folder") && opts?.method === "POST") {
        return { ok: true, status: 200, json: async () => ({ id: "new-item", message: "Saved" }) };
      }
      if (typeof url === "string" && url.includes("/folders")) {
        return { ok: true, status: 200, json: async () => [folder] };
      }
      return { ok: true, status: 200, json: async () => [] };
    });

    render(<SaveToFolderButton toolType="Quiz" />);

    // Open the modal
    fireEvent.click(screen.getByText("Save to Folder"));

    await waitFor(() => expect(screen.getByText("Save Here")).toBeInTheDocument());

    // Select the folder (it may be auto-selected as first)
    fireEvent.click(screen.getByText("Save Here"));

    // Click "Save" button in footer
    const saveBtn = screen.getByText("Save");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const saveCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => typeof url === "string" && url.includes("/save-to-folder") && opts?.method === "POST"
      );
      expect(saveCalls.length).toBe(1);
    });
  });

  it("no localStorage used for folderItems:", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    global.fetch.mockImplementation(async (url, opts) => {
      if (typeof url === "string" && url.includes("/save-to-folder")) {
        return { ok: true, status: 200, json: async () => ({ id: "x", message: "ok" }) };
      }
      if (typeof url === "string" && url.includes("/folders")) {
        return { ok: true, status: 200, json: async () => [folder] };
      }
      return { ok: true, status: 200, json: async () => [] };
    });

    render(<SaveToFolderButton toolType="Notes" />);
    fireEvent.click(screen.getByText("Save to Folder"));
    await waitFor(() => expect(screen.getByText("Save Here")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Save Here"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      const folderItemsCalls = setItemSpy.mock.calls.filter(
        ([key]) => typeof key === "string" && key.startsWith("folderItems:")
      );
      expect(folderItemsCalls.length).toBe(0);
    });

    setItemSpy.mockRestore();
  });

  it("creates new folder if needed", async () => {
    global.fetch.mockImplementation(async (url, opts) => {
      if (typeof url === "string" && url.includes("/folders") && opts?.method === "POST" && !url.includes("save-to")) {
        return { ok: true, status: 200, json: async () => ({ id: "new-folder", name: "New Folder", color: "from-indigo-100 to-indigo-200", parentFolderId: null, starred: false, items: 0 }) };
      }
      if (typeof url === "string" && url.includes("/save-to-folder")) {
        return { ok: true, status: 200, json: async () => ({ id: "item-1", message: "ok" }) };
      }
      if (typeof url === "string" && url.includes("/folders")) {
        return { ok: true, status: 200, json: async () => [folder] };
      }
      return { ok: true, status: 200, json: async () => [] };
    });

    render(<SaveToFolderButton toolType="Quiz" />);
    fireEvent.click(screen.getByText("Save to Folder"));
    await waitFor(() => expect(screen.getByText("Save Here")).toBeInTheDocument());

    // Switch to "Create New" tab
    fireEvent.click(screen.getByText("Create New"));

    // Wait for loading to finish and the form to appear
    await waitFor(() => expect(screen.getByPlaceholderText("e.g., Project Documentation")).toBeInTheDocument());
    const nameInput = screen.getByPlaceholderText("e.g., Project Documentation");
    fireEvent.change(nameInput, { target: { value: "New Folder" } });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      const folderPosts = global.fetch.mock.calls.filter(
        ([url, opts]) => typeof url === "string" && url.includes("/folders") && opts?.method === "POST" && !url.includes("save-to")
      );
      expect(folderPosts.length).toBe(1);
    });
  });

  it("calls setItem on localStorage after save", async () => {
    const origSetItem = window.localStorage?.setItem?.bind(window.localStorage) || (() => {});
    const calledKeys = [];
    const setItemMock = vi.fn((key, val) => {
      calledKeys.push(key);
      try { origSetItem(key, val); } catch { /* noop */ }
    });
    Object.defineProperty(window, "localStorage", {
      value: { ...window.localStorage, setItem: setItemMock, getItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() },
      writable: true,
      configurable: true,
    });

    global.fetch.mockImplementation(async (url, opts) => {
      if (typeof url === "string" && url.includes("/save-to-folder") && opts?.method === "POST") {
        return { ok: true, status: 200, json: async () => ({ id: "x", message: "ok" }) };
      }
      if (typeof url === "string" && url.includes("/folders")) {
        return { ok: true, status: 200, json: async () => [folder] };
      }
      return { ok: true, status: 200, json: async () => [] };
    });

    render(<SaveToFolderButton toolType="Notes" />);
    fireEvent.click(screen.getByText("Save to Folder"));
    await waitFor(() => expect(screen.getByText("Save Here")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Save Here"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(calledKeys).toContain("folders:changed");
    });
  });
});
