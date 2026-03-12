import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { getTasks } from "../api/apiService";
import { useNavigate } from "react-router-dom";
import { Clock, Trophy, Star, Target, BookOpen, Calendar, User } from "lucide-react";
import { motion } from "framer-motion";

const Dashboard = () => {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();

  // -------------------------
  // USER DATA
  // -------------------------
  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    if (accounts.length === 0) {
      navigate("/signin");
      return;
    }

    if (!instance.getActiveAccount() && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
    }

    const account = instance.getActiveAccount() || accounts[0];
    const name =
      account?.name ||
      account?.idTokenClaims?.name ||
      account?.idTokenClaims?.given_name ||
      account?.idTokenClaims?.identity?.displayName ||
      account?.idTokenClaims?.identity?.firstName ||
      (account?.idTokenClaims?.emails && account?.idTokenClaims?.emails[0]) ||
      account?.username?.split("@")[0] ||
      "User";

    const email =
      account?.username ||
      (account?.idTokenClaims?.emails && account?.idTokenClaims?.emails[0]) ||
      account?.idTokenClaims?.email ||
      "Not available";

    setUserData({ name, email, id: account.localAccountId });
    setLoadingUser(false);
  }, [instance, accounts, navigate]);

  // -------------------------
  // TASKS
  // -------------------------
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [taskError, setTaskError] = useState(null);

  useEffect(() => {
    if (!userData) return;

    const fetchTasks = async () => {
      try {
        setLoadingTasks(true);
        const data = await getTasks();
        setTasks(data);
        setTaskError(null);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        setTaskError("Failed to load tasks");
      } finally {
        setLoadingTasks(false);
      }
    };

    fetchTasks();
  }, [userData]);

  // -------------------------
  // TEACHERS
  // -------------------------
  const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2);

  const [teachers, setTeachers] = useState(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("dashboard_teachers");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: generateId(),
            name: "Dr. Sarah Wilson",
            subject: "Mathematics",
            image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
          },
          {
            id: generateId(),
            name: "Prof. Michael Chen",
            subject: "Physics",
            image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
          },
        ];
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("dashboard_teachers", JSON.stringify(teachers));
    }
  }, [teachers]);

  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [teacherName, setTeacherName] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("");
  const [teacherImage, setTeacherImage] = useState("");

  const openAddTeacher = () => {
    setEditingTeacher(null);
    setTeacherName("");
    setTeacherSubject("");
    setTeacherImage("");
    setIsTeacherModalOpen(true);
  };

  const openEditTeacher = (teacher) => {
    setEditingTeacher(teacher);
    setTeacherName(teacher.name);
    setTeacherSubject(teacher.subject);
    setTeacherImage(teacher.image);
    setIsTeacherModalOpen(true);
  };

  const saveTeacher = () => {
    if (!teacherName.trim() || !teacherSubject.trim()) return;

    if (editingTeacher) {
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === editingTeacher.id
            ? { ...t, name: teacherName, subject: teacherSubject, image: teacherImage }
            : t
        )
      );
    } else {
      setTeachers((prev) => [
        ...prev,
        {
          id: generateId(),
          name: teacherName,
          subject: teacherSubject,
          image: teacherImage || "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
        },
      ]);
    }

    setIsTeacherModalOpen(false);
  };

  const deleteTeacher = (id) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
  };

  // -------------------------
  // SCHEDULE & GOALS
  // -------------------------

  // -------------------------
  // SCHEDULE (NEW FULL CRUD)
  // -------------------------
  const [schedule, setSchedule] = useState(() => {
    const saved = localStorage.getItem("dashboard_schedule");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: generateId(),
            subject: "Mathematics",
            time: "09:00 - 10:30 AM",
            teacher: "Dr. Sarah Wilson",
          },
        ];
  });

  useEffect(() => {
    localStorage.setItem("dashboard_schedule", JSON.stringify(schedule));
  }, [schedule]);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleSubject, setScheduleSubject] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleTeacher, setScheduleTeacher] = useState("");

  const openAddSchedule = () => {
    setEditingSchedule(null);
    setScheduleSubject("");
    setScheduleTime("");
    setScheduleTeacher("");
    setIsScheduleModalOpen(true);
  };

  const openEditSchedule = (item) => {
    setEditingSchedule(item);
    setScheduleSubject(item.subject);
    setScheduleTime(item.time);
    setScheduleTeacher(item.teacher);
    setIsScheduleModalOpen(true);
  };

  const saveSchedule = () => {
    if (!scheduleSubject.trim() || !scheduleTime.trim() || !scheduleTeacher.trim()) return;

    if (editingSchedule) {
      setSchedule((prev) =>
        prev.map((s) =>
          s.id === editingSchedule.id
            ? { ...s, subject: scheduleSubject, time: scheduleTime, teacher: scheduleTeacher }
            : s
        )
      );
    } else {
      setSchedule((prev) => [
        ...prev,
        {
          id: generateId(),
          subject: scheduleSubject,
          time: scheduleTime,
          teacher: scheduleTeacher,
        },
      ]);
    }

    setIsScheduleModalOpen(false);
  };

  const deleteSchedule = (id) => {
    setSchedule((prev) => prev.filter((s) => s.id !== id));
  };

  if (loadingUser) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const firstName = userData?.name?.split(" ")[0] || "User";
  const email = userData?.email || "Not available";

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {firstName}!
        </h1>
        <p>You're signed in as <span className="font-medium">{email}</span></p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <TeachersSection
          teachers={teachers}
          openAddTeacher={openAddTeacher}
          openEditTeacher={openEditTeacher}
          deleteTeacher={deleteTeacher}
        />

        <ScheduleSection
          schedule={schedule}
          openAddSchedule={openAddSchedule}
          openEditSchedule={openEditSchedule}
          deleteSchedule={deleteSchedule}
        />
      </motion.div>

      {isTeacherModalOpen && (
        <TeacherModal
          editingTeacher={editingTeacher}
          teacherName={teacherName}
          setTeacherName={setTeacherName}
          teacherSubject={teacherSubject}
          setTeacherSubject={setTeacherSubject}
          teacherImage={teacherImage}
          setTeacherImage={setTeacherImage}
          saveTeacher={saveTeacher}
          closeModal={() => setIsTeacherModalOpen(false)}
        />
      )}

      {isScheduleModalOpen && (
        <ScheduleModal
          editingSchedule={editingSchedule}
          scheduleSubject={scheduleSubject}
          setScheduleSubject={setScheduleSubject}
          scheduleTime={scheduleTime}
          setScheduleTime={setScheduleTime}
          scheduleTeacher={scheduleTeacher}
          setScheduleTeacher={setScheduleTeacher}
          saveSchedule={saveSchedule}
          closeModal={() => setIsScheduleModalOpen(false)}
        />
      )}
    </div>
  );
};

// -------------------------
// SCHEDULE COMPONENT
// -------------------------
const ScheduleSection = ({ schedule, openAddSchedule, openEditSchedule, deleteSchedule }) => (
  <div className="bg-white rounded-xl shadow-sm p-6">
    <div className="flex justify-between mb-4">
      <h2 className="text-xl font-semibold">Schedule</h2>
      <button
        onClick={openAddSchedule}
        className="bg-primary-600 text-white px-3 py-1 rounded-lg"
      >
        + Add
      </button>
    </div>

    <div className="space-y-4">
      {schedule.map((item) => (
        <div key={item.id} className="p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between">
            <h3 className="font-medium">{item.subject}</h3>
            <span className="text-sm text-primary-600">{item.time}</span>
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-sm text-gray-500">{item.teacher}</p>
            <div className="flex gap-3">
              <button
                onClick={() => openEditSchedule(item)}
                className="text-blue-600 text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => deleteSchedule(item.id)}
                className="text-red-600 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// -------------------------
// SCHEDULE MODAL
// -------------------------
const ScheduleModal = ({
  editingSchedule,
  scheduleSubject,
  setScheduleSubject,
  scheduleTime,
  setScheduleTime,
  scheduleTeacher,
  setScheduleTeacher,
  saveSchedule,
  closeModal,
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
    <div className="bg-white p-6 rounded-lg w-96">
      <h2 className="text-lg font-semibold mb-4">
        {editingSchedule ? "Edit Class" : "Add Class"}
      </h2>

      <input
        type="text"
        placeholder="Subject"
        value={scheduleSubject}
        onChange={(e) => setScheduleSubject(e.target.value)}
        className="w-full border p-2 mb-3 rounded"
      />

      <input
        type="text"
        placeholder="Time"
        value={scheduleTime}
        onChange={(e) => setScheduleTime(e.target.value)}
        className="w-full border p-2 mb-3 rounded"
      />

      <input
        type="text"
        placeholder="Teacher"
        value={scheduleTeacher}
        onChange={(e) => setScheduleTeacher(e.target.value)}
        className="w-full border p-2 mb-3 rounded"
      />

      <div className="flex justify-end gap-3">
        <button onClick={closeModal} className="border px-4 py-2 rounded">
          Cancel
        </button>
        <button
          onClick={saveSchedule}
          className="bg-primary-600 text-white px-4 py-2 rounded"
        >
          Save
        </button>
      </div>
    </div>
  </div>
);


// -------------------------
// CHILD COMPONENTS
// -------------------------

const TeachersSection = ({ teachers, openAddTeacher, openEditTeacher, deleteTeacher }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl shadow-sm p-6">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-primary-600" />
        <h2 className="text-xl font-semibold text-gray-900">Your Teachers</h2>
      </div>
      <button onClick={openAddTeacher} className="px-3 py-1 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">+ Add</button>
    </div>
    <div className="space-y-4">
      {teachers.map((teacher) => (
        <div key={teacher.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-4">
            <img src={teacher.image} alt={teacher.name} className="w-12 h-12 rounded-full object-cover"/>
            <div>
              <h3 className="font-medium text-gray-900">{teacher.name}</h3>
              <p className="text-sm text-gray-500">{teacher.subject}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => openEditTeacher(teacher)} className="text-blue-600 text-sm hover:underline">Edit</button>
            <button onClick={() => deleteTeacher(teacher.id)} className="text-red-600 text-sm hover:underline">Delete</button>
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

const TeacherModal = ({ editingTeacher, teacherName, setTeacherName, teacherSubject, setTeacherSubject, teacherImage, setTeacherImage, saveTeacher, closeModal }) => (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
      <h2 className="text-xl font-semibold mb-4">{editingTeacher ? "Edit Teacher" : "Add Teacher"}</h2>
      <div className="space-y-4">
        <input type="text" placeholder="Teacher Name" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2"/>
        <input type="text" placeholder="Subject" value={teacherSubject} onChange={(e) => setTeacherSubject(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2"/>
        <input type="text" placeholder="Image URL (optional)" value={teacherImage} onChange={(e) => setTeacherImage(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2"/>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300">Cancel</button>
        <button onClick={saveTeacher} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save</button>
      </div>
    </div>
  </div>
);


const GoalsSection = ({ goals }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="bg-white rounded-xl shadow-sm p-6">
    <div className="flex items-center gap-2 mb-6">
      <Target className="h-5 w-5 text-primary-600"/>
      <h2 className="text-xl font-semibold text-gray-900">Learning Goals</h2>
    </div>
    <div className="space-y-6">
      {goals.map((goal, idx) => (
        <div key={idx} className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-900">{goal.title}</h3>
            <span className="text-sm text-gray-500">{goal.progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${goal.progress}%` }} transition={{ duration: 1, delay: 0.5 }} className="h-full bg-primary-600 rounded-full"/>
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

const AchievementsSection = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="lg:col-span-3 bg-white rounded-xl shadow-sm p-6">
    <div className="flex items-center gap-2 mb-6">
      <Trophy className="h-5 w-5 text-primary-600"/>
      <h2 className="text-xl font-semibold text-gray-900">Recent Achievements</h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <AchievementCard icon={Trophy} title="7 Day Streak" description="Consistent learning pays off!" color="text-blue-600" bgColor="bg-blue-100"/>
      <AchievementCard icon={Star} title="Top Student" description="Ranked #1 in Physics" color="text-yellow-600" bgColor="bg-yellow-100"/>
      <AchievementCard icon={BookOpen} title="Quick Learner" description="Completed 5 modules this week" color="text-green-600" bgColor="bg-green-100"/>
    </div>
  </motion.div>
);

const AchievementCard = ({ icon: Icon, title, description, color, bgColor }) => (
  <motion.div whileHover={{ scale: 1.02 }} className="p-4 rounded-lg bg-gray-50 flex items-start gap-4">
    <div className={`${bgColor} p-3 rounded-lg`}>
      <Icon className={`h-6 w-6 ${color}`}/>
    </div>
    <div>
      <h3 className="font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  </motion.div>
);

export default Dashboard;
