
import React, { useState } from "react";
import {
  FolderPlus,
  Star,
  BarChart3,
  FolderKanban,
  List
} from "lucide-react";
import FolderManager from "./FolderManager";
import { motion, AnimatePresence } from "framer-motion";

const folderStats = [
  {
    icon: <FolderKanban className="w-6 h-6 text-blue-700"/>,
    count: 4,
    label: "Total Folders",
    bg: "from-blue-500 to-indigo-500"
  },
  {
    icon: <Star className="w-6 h-6 text-yellow-600"/>,
    count: 2,
    label: "Starred Folders",
    bg: "from-yellow-400 to-amber-500"
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-green-600"/>,
    count: 41,
    label: "Total Items",
    bg: "from-green-400 to-emerald-500"
  }
];

const folderColors = [
  "from-indigo-100 to-indigo-200",
  "from-fuchsia-100 to-pink-100",
  "from-amber-100 to-yellow-100",
  "from-green-100 to-lime-100",
  "from-cyan-100 to-sky-100",
  "from-purple-100 to-violet-100",
  "from-red-100 to-rose-100"
];

const initialFolders = [
  { id: "1", name: "Project Documentation", items: 5, color: folderColors[0], starred: true },
  { id: "2", name: "Research Materials",   items: 8, color: folderColors[1], starred: false },
  { id: "3", name: "Design Assets",        items: 3, color: folderColors[2], starred: true },
  { id: "4", name: "Meeting Notes",        items: 6, color: folderColors[3], starred: false }
];

const Workspace = () => {
  const [view, setView] = useState("grid");
  const [folders, setFolders] = useState(initialFolders);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedColor, setSelectedColor] = useState(folderColors[0]);

  const createFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder = {
      id: Date.now().toString(),
      name: newFolderName,
      items: 0,
      color: selectedColor,
      starred: false
    };
    setFolders([newFolder, ...folders]);
    setNewFolderName("");
    setSelectedColor(folderColors[0]);
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen px-6 py-8 bg-gradient-to-br from-white via-slate-100 to-slate-200">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">My Workspace</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search folders and content..."
            className="px-4 py-2 rounded-full shadow-md bg-white/70 backdrop-blur text-slate-700 w-72 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={() => setView(v => v === "grid" ? "list" : "grid")}
            className="p-2 rounded-lg shadow-inner bg-white/70 backdrop-blur border border-slate-300"
          >
            {view === "grid"
              ? <List className="w-5 h-5 text-slate-700"/>
              : <FolderKanban className="w-5 h-5 text-slate-700"/>}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl shadow bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-medium hover:scale-[1.03] transition-transform"
          >
            <FolderPlus className="inline w-4 h-4 mr-2"/> New Folder
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {folderStats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`p-6 rounded-2xl text-white shadow-xl bg-gradient-to-br ${stat.bg}`}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white bg-opacity-20">{stat.icon}</div>
              <div>
                <div className="text-2xl font-bold">{stat.count}</div>
                <div className="text-sm opacity-90">{stat.label}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* FOLDER MANAGER */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <FolderManager view={view} folders={folders} setFolders={setFolders}/>
      </motion.div>

      {/* MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex justify-center items-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-[90%] max-w-md space-y-6"
            >
              <h2 className="text-xl font-bold text-slate-800">Create New Folder</h2>
              <input
                className="w-full px-4 py-2 rounded-xl border border-slate-300 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Folder name"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {folderColors.map((color, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} border-2 ${
                      selectedColor === color ? "border-blue-500" : "border-transparent"
                    }`}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={createFolder}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Workspace;
