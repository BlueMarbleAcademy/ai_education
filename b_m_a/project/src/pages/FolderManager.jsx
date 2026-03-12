import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Pencil, FolderKanban, List } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Props:
 * - view: "grid" | "list"
 * - folders: Array<{ id, name, items, color, starred, createdAt?, updatedAt? }>
 * - onToggleStar: (id) => Promise|void
 * - onRename: (id, newName) => Promise|void
 * - onDelete: (id) => Promise|void
 */

const MAX_FOLDER_NAME_LENGTH = 40;


const ConfirmModal = ({
  open,
  title,
  subtitle,
  confirmLabel = "Delete",
  onClose,
  onConfirm,
}) => {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white shadow hover:brightness-110"
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default function FolderManager({
  view,
  folders,
  onToggleStar,
  onRename,
  onDelete,
}) {
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");


  const openRenameModal = (folder) => {
    setRenameTarget(folder);
    setRenameValue(folder.name);
  };


  const sorted = [
    ...folders.filter((f) => f.starred),
    ...folders.filter((f) => !f.starred),
  ];

  // LIST VIEW
  if (view === "list") {
    return (
      <>
        <ul className="space-y-3">
          {sorted.map((folder) => (
            <motion.li
              key={folder.id}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-4 bg-white rounded-xl shadow cursor-pointer"
              onClick={() => navigate(`/workspace/folder/${folder.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${folder.color}`} />
                <div>
                  <div className="font-semibold text-slate-800">{folder.name}</div>
                  <div className="text-sm text-slate-500">{folder.items ?? 0} items</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); openRenameModal(folder); }}
                  title="Rename"
                >
                  <Pencil className="w-5 h-5 text-blue-500 hover:text-blue-700" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(folder);
                  }}
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5 text-red-400 hover:text-red-600" />
                </button>
              </div>
            </motion.li>
          ))}
        </ul>

        <ConfirmModal
          open={!!pendingDelete}
          title="Delete this folder?"
          subtitle={
            pendingDelete
              ? `“${pendingDelete.name}” and all files inside will be permanently deleted. This action cannot be undone.`
              : ""
          }
          onClose={() => setPendingDelete(null)}
          onConfirm={async () => {
            if (!pendingDelete) return;
            await onDelete(pendingDelete.id);
            setPendingDelete(null);
          }} 
        />
      </>
    );
  }

  // GRID VIEW
  return (
    <>
      {folders.some((f) => f.starred) && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">⭐ Starred</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {folders.filter((f) => f.starred).map((folder) => (
              <motion.div
                key={folder.id}
                onClick={() => navigate(`/workspace/folder/${folder.id}`)}
                whileHover={{ scale: 1.02 }}
                className={`rounded-3xl p-5 bg-gradient-to-br ${folder.color} cursor-pointer shadow-md border border-white/40 relative`}
              >
                <div className="text-lg font-bold text-slate-800 mb-1">{folder.name}</div>
                <div className="text-sm text-slate-600">{folder.items ?? 0} items</div>
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); openRenameModal(folder); }}
                    title="Rename"
                  >
                    <Pencil className="w-4 h-4 text-blue-500 hover:text-blue-700" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDelete(folder);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {folders.filter((f) => !f.starred).map((folder) => (
            <motion.div
              key={folder.id}
              onClick={() => navigate(`/workspace/folder/${folder.id}`)}
              whileHover={{ scale: 1.02 }}
              className={`rounded-3xl p-5 bg-gradient-to-br ${folder.color} cursor-pointer shadow-md border border-white/40 relative`}
            >
              <div className="text-lg font-bold text-slate-800 mb-1">{folder.name}</div>
              <div className="text-sm text-slate-600">{folder.items ?? 0} items</div>
              <div className="absolute top-3 right-3 flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); openRenameModal(folder); }}
                  title="Rename"
                >
                  <Pencil className="w-4 h-4 text-blue-500 hover:text-blue-700" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(folder);
                  }}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={!!pendingDelete}
        title="Delete this folder?"
        subtitle={
          pendingDelete
            ? `“${pendingDelete.name}” and all files inside will be permanently deleted. This action cannot be undone.`
            : ""
        }
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />

      <AnimatePresence>
        {renameTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex justify-center items-center"
            onClick={() => setRenameTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-[90%] max-w-md space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-slate-800">
                Rename Folder
              </h2>

              <input
                className="w-full px-4 py-2 rounded-xl border border-slate-300 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={renameValue}
                maxLength={MAX_FOLDER_NAME_LENGTH}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_FOLDER_NAME_LENGTH) {
                    setRenameValue(e.target.value);
                  }
                }}
              />

              <p className={`text-sm text-right ${renameValue.length > MAX_FOLDER_NAME_LENGTH * 0.8
                  ? "text-amber-500"
                  : "text-slate-500"
                }`}>
                {renameValue.length}/{MAX_FOLDER_NAME_LENGTH}
              </p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setRenameTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300"
                >
                  Cancel
                </button>

                <button
                  onClick={async () => {
                    if (
                      !renameValue.trim() ||
                      renameValue.trim() === renameTarget.name
                    ) {
                      return;
                    }

                    await onRename(renameTarget.id, renameValue.trim());
                    setRenameTarget(null);
                  }}
                  disabled={
                    !renameValue.trim() ||
                    renameValue.trim() === renameTarget?.name
                  }
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </>
  );
}
