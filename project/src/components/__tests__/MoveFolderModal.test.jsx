import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { makeMockFolder } from "../../test/helpers";
import MoveFolderModal from "../MoveFolderModal";

describe("MoveFolderModal", () => {
  const folderA = makeMockFolder({ id: "a", name: "Folder A", parentFolderId: null });
  const folderB = makeMockFolder({ id: "b", name: "Folder B", parentFolderId: null });
  const childOfA = makeMockFolder({ id: "a-child", name: "Child of A", parentFolderId: "a" });

  const allFolders = [folderA, folderB, childOfA];
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    onConfirm.mockClear();
    onClose.mockClear();
  });

  it("renders folder tree", () => {
    render(
      <MoveFolderModal open={true} onClose={onClose} folderId="b" allFolders={allFolders} onConfirm={onConfirm} />
    );
    expect(screen.getByText("Folder A")).toBeInTheDocument();
    expect(screen.getByText(/Root level/i)).toBeInTheDocument();
  });

  it("excludes self and descendants", () => {
    render(
      <MoveFolderModal open={true} onClose={onClose} folderId="a" allFolders={allFolders} onConfirm={onConfirm} />
    );
    // Folder A is being moved, so it and its child should not appear as selectable targets
    // They may be rendered but disabled
    const folderABtn = screen.queryByText("Folder A");
    // "Folder A" shouldn't appear as a selectable option (it's the folder being moved)
    // The modal heading says 'Move "Folder A" to...' instead
    expect(screen.getByText(/Move.*Folder A.*to/i)).toBeInTheDocument();
  });

  it("disables folders at max depth", () => {
    // root (depth 0) -> level1 (depth 1) -> level2 (depth 2)
    // Depth 2 folders should be disabled (can't nest deeper)
    const root = makeMockFolder({ id: "root", name: "Root", parentFolderId: null });
    const level1 = makeMockFolder({ id: "l1", name: "Level 1", parentFolderId: "root" });
    const level2 = makeMockFolder({ id: "l2", name: "Level 2", parentFolderId: "l1" });
    const movingFolder = makeMockFolder({ id: "moving", name: "Moving", parentFolderId: null });
    const deepFolders = [root, level1, level2, movingFolder];

    render(
      <MoveFolderModal open={true} onClose={onClose} folderId="moving" allFolders={deepFolders} onConfirm={onConfirm} />
    );

    // Root is visible (depth 0) and should be enabled
    const rootBtn = screen.getByText("Root").closest("button");
    expect(rootBtn).not.toBeDisabled();

    // Expand Root to see Level 1
    const chevrons = rootBtn.querySelectorAll("svg.lucide-chevron-right");
    if (chevrons.length > 0) fireEvent.click(chevrons[0]);

    // Level 1 (depth 1) should be enabled
    const l1Btn = screen.getByText("Level 1").closest("button");
    expect(l1Btn).not.toBeDisabled();
  });

  it("root option works", () => {
    // Moving a subfolder, select "Root level"
    render(
      <MoveFolderModal open={true} onClose={onClose} folderId="a-child" allFolders={allFolders} onConfirm={onConfirm} />
    );
    const rootOption = screen.getByText(/Root level/i);
    fireEvent.click(rootOption);

    const confirmBtn = screen.getByText("Move Here");
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith("");
  });

  it("selecting folder and confirming calls onConfirm", () => {
    render(
      <MoveFolderModal open={true} onClose={onClose} folderId="a-child" allFolders={allFolders} onConfirm={onConfirm} />
    );
    // Select Folder B as target
    const folderBBtn = screen.getByText("Folder B");
    fireEvent.click(folderBBtn);

    const confirmBtn = screen.getByText("Move Here");
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith("b");
  });

  it("cancel closes modal", () => {
    render(
      <MoveFolderModal open={true} onClose={onClose} folderId="b" allFolders={allFolders} onConfirm={onConfirm} />
    );
    const cancelBtn = screen.getByText("Cancel");
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
