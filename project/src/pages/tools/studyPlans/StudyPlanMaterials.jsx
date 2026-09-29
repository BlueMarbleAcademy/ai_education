import React, { useState } from "react";
import {
  AlertCircle,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

const StudyPlanMaterials = ({
  materials = [],
  onAddMaterials,
  onRemoveMaterial,
  isSaving = false,
  error = "",
}) => {
  const [selectionError, setSelectionError] = useState("");

  const handleSelection = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    const allowedExtensions = [
      ".pdf",
      ".docx",
      ".txt",
      ".pptx",
    ];

    const maxFileSize = 20 * 1024 * 1024;

    const validFiles = [];
    const errors = [];

    files.forEach((file) => {
      const fileName = file.name.toLowerCase();

      const hasValidExtension = allowedExtensions.some((extension) =>
        fileName.endsWith(extension)
      );

      if (!hasValidExtension) {
        errors.push(`${file.name}: Unsupported file type.`);
        return;
      }

      if (file.size > maxFileSize) {
        errors.push(`${file.name}: File is larger than 20 MB.`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      setSelectionError(errors.join(" "));
    } else {
      setSelectionError("");
    }

    if (validFiles.length > 0) {
      await onAddMaterials(validFiles);
    }
  };

  return (
    <section
      aria-labelledby="plan-materials-heading"
      className="rounded-lg border border-[#dce5df] bg-white p-4 shadow-[0_8px_30px_rgba(45,67,53,0.06)] sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-[#fff0d9] p-2 text-[#9a641c]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 id="plan-materials-heading" className="font-bold text-[#26372d]">
              Study materials
            </h2>
            <p className="mt-0.5 text-sm text-[#718077]">
              {materials.length === 0
                ? "Add files for this study plan."
                : `${materials.length} saved file${materials.length === 1 ? "" : "s"}`}
            </p>
            <p className="mt-1 text-xs text-[#8a968e]">
              Supported files: PDF, DOCX, TXT, PPTX
            </p>
          </div>
        </div>

        <label className={`inline-flex items-center justify-center gap-2 rounded-md bg-[#5b3a8c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#472b70] ${isSaving ? "cursor-wait opacity-60" : "cursor-pointer"}`}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isSaving ? "Saving..." : "Add Files"}
          <input
            type="file"
            accept=".pdf,.docx,.txt,.pptx"
            multiple
            disabled={isSaving}
            onChange={handleSelection}
            className="sr-only"
          />
        </label>
      </div>

      {selectionError && (
        <p
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-md border border-[#e6b8b8] bg-[#fff3f3] px-3 py-2 text-sm font-medium text-[#9b3434]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {selectionError}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 flex items-center gap-2 rounded-md border border-[#e6b8b8] bg-[#fff3f3] px-3 py-2 text-sm font-medium text-[#9b3434]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {materials.length === 0 ? (
        <div className="mt-5 border-t border-[#e5ebe7] pt-5 text-center">
          <FileText className="mx-auto h-7 w-7 text-[#9aa79f]" />
          <p className="mt-2 text-sm font-medium text-[#68766d]">
            No study materials connected yet
          </p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-[#e5ebe7] border-t border-[#e5ebe7]">
          {materials.map((material, index) => (
            <li
              key={material.id || `${material.name}-${index}`}
              className="flex items-center gap-3 py-3"
            >
              <FileText className="h-5 w-5 shrink-0 text-[#9a641c]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#33443a]">
                  {material.name || material.filename || "Study material"}
                </p>
                <p className="mt-0.5 text-xs text-[#718077]">
                  {formatFileSize(material.fileSize)} · Saved with this plan
                </p>
              </div>
              {material.id && (
                <button
                  type="button"
                  onClick={() => onRemoveMaterial(material.id)}
                  disabled={isSaving}
                  aria-label={`Remove ${material.name || "study material"}`}
                  className="rounded-md p-2 text-[#8a5e5e] transition hover:bg-[#fff3f3] hover:text-[#a33b3b] disabled:cursor-wait disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const formatFileSize = (bytes) => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "Unknown size";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export default StudyPlanMaterials;
