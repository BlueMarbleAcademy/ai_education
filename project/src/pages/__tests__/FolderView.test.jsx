import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { mockApiFetch, renderWithRouter, makeMockFolder, makeMockItem } from "../../test/helpers";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "test-folder-id" }),
    useSearchParams: () => [new URLSearchParams(""), vi.fn()],
  };
});

import FolderView from "../FolderView";

function setupFolderMocks(folder, subfolders = [], items = []) {
  mockApiFetch("/folders", [folder, ...subfolders]);
  mockApiFetch(`/folders/${folder.id}/items`, items);
}

describe("FolderView - Click Handlers", () => {
  const folder = makeMockFolder({ id: "test-folder-id", name: "Test Folder" });

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("clicking mindmap navigates to /tools/maps/:id", async () => {
    const mindmapItem = makeMockItem({
      id: "map-123",
      contentType: "mindmap",
      title: "Flow Chart",
      folderId: folder.id,
      data: { title: "Flow Chart" },
    });
    setupFolderMocks(folder, [], [mindmapItem]);

    renderWithRouter(<FolderView />, { route: `/workspace/folder/${folder.id}` });
    await waitFor(() => expect(screen.getByText("Flow Chart")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Flow Chart"));
    expect(mockNavigate).toHaveBeenCalledWith("/tools/maps/map-123");
  });

  it("clicking summary navigates to /tools/summarizer?summaryId=", async () => {
    const summaryItem = makeMockItem({
      id: "sum-456",
      contentType: "summary",
      title: "Chapter Summary",
      folderId: folder.id,
    });
    setupFolderMocks(folder, [], [summaryItem]);

    renderWithRouter(<FolderView />, { route: `/workspace/folder/${folder.id}` });
    await waitFor(() => expect(screen.getByText("Chapter Summary")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Chapter Summary"));
    expect(mockNavigate).toHaveBeenCalledWith("/tools/summarizer?summaryId=sum-456");
  });

  it("clicking quiz navigates to /tools/practice-tests?quizId=", async () => {
    const quizItem = makeMockItem({
      id: "quiz-789",
      contentType: "quiz",
      title: "Math Quiz",
      folderId: folder.id,
      data: { title: "Math Quiz", questions: [] },
    });
    setupFolderMocks(folder, [], [quizItem]);

    renderWithRouter(<FolderView />, { route: `/workspace/folder/${folder.id}` });
    await waitFor(() => expect(screen.getByText("Math Quiz")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Math Quiz"));
    expect(mockNavigate).toHaveBeenCalledWith("/tools/practice-tests?quizId=quiz-789");
  });
});

describe("FolderView - Subfolder Edit/Delete", () => {
  const folder = makeMockFolder({ id: "test-folder-id", name: "Parent Folder" });
  const subfolder = makeMockFolder({
    id: "sub-1",
    name: "Subfolder One",
    parentFolderId: folder.id,
    items: 2,
  });

  beforeEach(() => {
    mockNavigate.mockClear();
    setupFolderMocks(folder, [subfolder], []);
  });

  it("subfolder edit button opens edit modal", async () => {
    renderWithRouter(<FolderView />, { route: `/workspace/folder/${folder.id}` });
    await waitFor(() => expect(screen.getByText("Subfolder One")).toBeInTheDocument());

    const editButtons = screen.getAllByTitle(/Edit subfolder/i);
    fireEvent.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Subfolder")).toBeInTheDocument();
    });
  });

  it("subfolder rename calls PATCH", async () => {
    global.fetch.mockImplementation(async (url, opts) => {
      if (opts?.method === "PATCH" && url.includes("/folders/sub-1")) {
        return { ok: true, status: 200, json: async () => ({ ...subfolder, name: "Renamed" }) };
      }
      if (url.includes("/folders")) return { ok: true, status: 200, json: async () => [folder, subfolder] };
      return { ok: true, status: 200, json: async () => [] };
    });

    renderWithRouter(<FolderView />, { route: `/workspace/folder/${folder.id}` });
    await waitFor(() => expect(screen.getByText("Subfolder One")).toBeInTheDocument());

    const editButtons = screen.getAllByTitle(/Edit subfolder/i);
    fireEvent.click(editButtons[0]);
    await waitFor(() => expect(screen.getByText("Edit Subfolder")).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/Subfolder name/i);
    fireEvent.change(input, { target: { value: "Renamed" } });

    const saveBtn = screen.getByText("Save");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const patchCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => url.includes("/folders/sub-1") && opts?.method === "PATCH"
      );
      expect(patchCalls.length).toBeGreaterThan(0);
    });
  });

  it("subfolder delete button opens confirm modal", async () => {
    renderWithRouter(<FolderView />, { route: `/workspace/folder/${folder.id}` });
    await waitFor(() => expect(screen.getByText("Subfolder One")).toBeInTheDocument());

    const deleteButtons = screen.getAllByTitle(/Delete subfolder/i);
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/Delete this subfolder/i)).toBeInTheDocument();
    });
  });

  it("subfolder color picker highlights selected swatch", async () => {
    renderWithRouter(<FolderView />, { route: `/workspace/folder/${folder.id}` });
    await waitFor(() => expect(screen.getByText("Subfolder One")).toBeInTheDocument());

    fireEvent.click(screen.getAllByTitle(/Edit subfolder/i)[0]);
    await waitFor(() => expect(screen.getByText("Edit Subfolder")).toBeInTheDocument());

    const pinkSwatch = screen.getByTitle("from-fuchsia-100 to-pink-100");
    fireEvent.click(pinkSwatch);
    await waitFor(() => {
      const selected = screen.getByTitle("from-fuchsia-100 to-pink-100");
      expect(selected.className).toContain("border-indigo-500");
    });
  });

  it("subfolder delete calls DELETE on confirm", async () => {
    global.fetch.mockImplementation(async (url, opts) => {
      if (opts?.method === "DELETE") return { ok: true, status: 200, json: async () => ({ ok: true }) };
      if (url.includes("/folders")) return { ok: true, status: 200, json: async () => [folder, subfolder] };
      return { ok: true, status: 200, json: async () => [] };
    });

    renderWithRouter(<FolderView />, { route: `/workspace/folder/${folder.id}` });
    await waitFor(() => expect(screen.getByText("Subfolder One")).toBeInTheDocument());

    const deleteButtons = screen.getAllByTitle(/Delete subfolder/i);
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(screen.getByText(/Delete this subfolder/i)).toBeInTheDocument());

    const confirmBtn = screen.getByRole("button", { name: /^Delete$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      const deleteCalls = global.fetch.mock.calls.filter(
        ([url, opts]) => url.includes("/folders/sub-1") && opts?.method === "DELETE"
      );
      expect(deleteCalls.length).toBeGreaterThan(0);
    });
  });
});
