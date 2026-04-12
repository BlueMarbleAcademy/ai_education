import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { makeMockFolder } from "../../test/helpers";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

import FolderManager from "../FolderManager";

const defaultProps = {
  view: "grid",
  folders: [],
  allFolders: [],
  onToggleStar: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
  onMove: vi.fn(),
};

describe("FolderManager", () => {
  it("renders starred folders in separate section", () => {
    const folders = [
      makeMockFolder({ name: "Starred One", starred: true }),
      makeMockFolder({ name: "Normal One", starred: false }),
    ];
    render(<FolderManager {...defaultProps} folders={folders} allFolders={folders} />);
    expect(screen.getByText("Starred One")).toBeInTheDocument();
    expect(screen.getByText("Normal One")).toBeInTheDocument();
  });

  it("star button triggers onToggleStar", () => {
    const folder = makeMockFolder({ name: "Toggler", starred: false });
    const onToggleStar = vi.fn();
    render(<FolderManager {...defaultProps} folders={[folder]} allFolders={[folder]} onToggleStar={onToggleStar} />);

    const starButtons = screen.getAllByTitle(/Star/i);
    fireEvent.click(starButtons[0]);
    expect(onToggleStar).toHaveBeenCalledWith(folder.id);
  });

  it("move button opens MoveFolderModal", () => {
    const folder = makeMockFolder({ name: "Movable" });
    render(<FolderManager {...defaultProps} folders={[folder]} allFolders={[folder]} />);

    const moveButtons = screen.getAllByTitle(/Move folder/i);
    fireEvent.click(moveButtons[0]);
    // Modal should be visible (look for "Move" text in modal heading)
    expect(screen.getByText(/Move.*to/i)).toBeInTheDocument();
  });

  it("delete confirmation shows trash message", () => {
    const folder = makeMockFolder({ name: "Deletable" });
    render(<FolderManager {...defaultProps} folders={[folder]} allFolders={[folder]} />);

    const deleteButtons = screen.getAllByTitle(/Delete/i);
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByText(/moved to the trash/i)).toBeInTheDocument();
    expect(screen.getByText(/Recently Deleted/i)).toBeInTheDocument();
  });
});
