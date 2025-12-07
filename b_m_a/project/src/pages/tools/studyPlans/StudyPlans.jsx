import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { useMsal } from "@azure/msal-react";
import { msalInstance } from "../../../authConfig";
import {
  Book,
  PlusCircle,
  FileText,
  RefreshCw,
  Calendar,
  Tag,
  ChevronRight,
  Search,
  Filter,
  Check,
  Clock,
  Menu,
  Layout,
  BrainCircuit,
  BookMarked,
  Zap,
  Mic,
  Network,
  BookOpen,
  AlertCircle,
  Square,
  CheckSquare,
  Loader2,
} from "lucide-react";
import { getStudyPlans, getStudyPlan } from "../../../api/apiService";
import { useQuizData } from "../PracticeTests/hooks";
import { useDeckData } from "../AIFlashcards/hooks";
import StudyPlanWizard from "./StudyPlanWizard";
import StudyPlanDisplay from "./StudyPlanDisplay";
import SavedStudyPlansList from "./SavedStudyPlansList";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isWithinInterval,
  subDays,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
} from "date-fns";

/**
 * Main StudyPlans component that coordinates all other components
 */
const StudyPlans = () => {
  // State for component display
  const [showCreate, setShowCreate] = useState(false);
  const [showPlanner, setShowPlanner] = useState(true);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [planStatus, setPlanStatus] = useState("idle"); // idle, loading, ready, updating

  // State for search and filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchInputRef = useRef(null);

  // State for study plans
  const [studyPlans, setStudyPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingQuizTaskId, setLoadingQuizTaskId] = useState(null);

  // derived UI state
  const today = new Date();

  // Calendar month and selection state (must be declared before functions that use setSelectedDate)
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(null);
  const navigate = useNavigate();

  const { instance, accounts } = useMsal();
  const { generateQuiz } = useQuizData();
  const { generateFlashcards } = useDeckData();

  // Fetch saved study plans when planner is visible and user is authenticated.
  // Use both the React MSAL `accounts` array and the msal instance cache as cues —
  // on a hard refresh the React context may not populate immediately even though
  // msalInstance.getAllAccounts() has cached accounts.
  useEffect(() => {
    const cached = msalInstance.getAllAccounts() || [];
    // Debug log to help diagnose refresh timing issues
    // eslint-disable-next-line no-console
    console.debug("StudyPlans: showPlanner", showPlanner, "reactAccounts", accounts?.length, "cachedAccounts", cached.length);

    if (showPlanner && ((accounts && accounts.length > 0) || (cached && cached.length > 0))) {
      fetchStudyPlans();
    }
    // If no accounts yet, do nothing — this avoids calling the protected API before MSAL initializes on page refresh
  }, [showPlanner, accounts]);

  const fetchStudyPlans = async () => {
    try {
      setLoading(true);
      const plans = await getStudyPlans();
      const normalized = plans || [];
      setStudyPlans(normalized);

      // If we have plans, restore the last selected plan from localStorage (dev convenience)
      if (normalized.length > 0) {
        try {
          const stored = window.localStorage.getItem("selectedStudyPlanId");
          const found = stored ? normalized.find((p) => p.id === stored) : null;
          if (found) {
            setCurrentPlan(found);
          } else {
            // default to the most recent plan
            setCurrentPlan(normalized[0]);
          }
          // ensure calendar shows today by default when plans exist
          setSelectedDate(new Date());
        } catch (e) {
          console.warn("Could not access localStorage", e);
        }
      }
      setLoading(false);
    } catch (err) {
      console.error("Error fetching study plans:", err);
      setError("Failed to load study plans");
      setLoading(false);
    }
  };

  // Create a new study plan
  const handleCreatePlan = () => {
    setShowPlanner(false);
    setShowCreate(true);
    setCurrentPlan(null);
    setPlanStatus("idle");
  };

  // Go back to the planner view
  const handleBack = () => {
    setShowPlanner(true);
    setShowCreate(false);
    setCurrentPlan(null);
    fetchStudyPlans(); // Refresh the list when returning
  };

  // Load a saved study plan
  const handleSelectPlan = async (plan) => {
    setCurrentPlan(plan);
    try {
      window.localStorage.setItem("selectedStudyPlanId", plan?.id || "");
    } catch (e) {
      // ignore storage errors
    }
    setShowPlanner(false);
  };

  // Filter and rank study plans based on search and tag
  const filteredPlans = useMemo(() => {
    if (!studyPlans || studyPlans.length === 0) return [];
    const q = (searchQuery || "").trim().toLowerCase();

    // If no query and no tag filter, return all plans
    if (!q && !filterTag) return studyPlans;

    const scored = studyPlans.map((plan) => {
      const title = (plan.title || "").toLowerCase();
      const desc = (plan.description || "").toLowerCase();
      const tags = (plan.tags || []).map((t) => (t || "").toLowerCase());

      let score = 0;
      if (!q) {
        // If only filtering by tag
        if (!filterTag) score = 1;
        else if (tags.includes(filterTag.toLowerCase())) score = 50;
      } else {
        // Prioritize startsWith matches so results align with typed word
        if (title.startsWith(q)) score += 100;
        else if (title.split(/\s+/).some((w) => w.startsWith(q))) score += 80;
        else if (title.includes(q)) score += 50;

        if (desc.startsWith(q)) score += 40;
        else if (desc.includes(q)) score += 20;

        if (tags.some((t) => t.startsWith(q))) score += 60;
        else if (tags.some((t) => t.includes(q))) score += 30;
      }

      // Tag filter must match if provided
      const tagMatch = !filterTag || tags.includes(filterTag.toLowerCase());

      return { plan, score, tagMatch };
    });

    // Keep only plans that match the tag filter and have a positive score (or keep all if query empty)
    const filtered = scored
      .filter((s) => s.tagMatch && (q ? s.score > 0 : true))
      .sort((a, b) => b.score - a.score)
      .map((s) => s.plan);

    return filtered;
  }, [studyPlans, searchQuery, filterTag]);

  // Get all unique tags from study plans
  const getAllTags = () => {
    if (!studyPlans || studyPlans.length === 0) return [];
    const allTags = studyPlans.flatMap((plan) => plan.tags || []);
    return [...new Set(allTags)];
  };

  // Immediate tasks derived from study plan contents (soonest upcoming activities)
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  // All mapped tasks across plans for calendar rendering (not limited)
  const [allPlanTasks, setAllPlanTasks] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadUpcoming = async () => {
      if (!studyPlans || studyPlans.length === 0) {
        if (mounted) setUpcomingTasks([]);
        return;
      }

      const tasks = [];

      // Fetch full plan details for the most recent plans until we have enough tasks
      const candidates = studyPlans.slice(0, 6);
      for (const p of candidates) {
        try {
          const full = await getStudyPlan(p.id);
          const content = full?.data?.content;
          if (!content || !content.weekly_schedule) continue;

          // Iterate weeks/days/topics/activities in order and collect tasks
          // Only include tasks that fall on today (current calendar day).
          // Map plan days to calendar dates using a weekly offset so that
          // week N maps to baseDate + (N-1)*7 days + dayIndex within that week.
          const baseDate = p.createdAt ? new Date(p.createdAt) : new Date();
          const baseWeekStart = startOfWeek(baseDate);
          const weeks = content.weekly_schedule || [];
          for (let wi = 0; wi < weeks.length; wi++) {
            const week = weeks[wi];
            const days = week.days || [];
            for (let di = 0; di < days.length; di++) {
              const day = days[di];
              // If the plan includes schedule_info.selectedDays, map the day slot
              // to the user's preferred weekday. selectedDays is expected to be
              // an array of weekday numbers 0(Sun)-6(Sat).
              const preferred = full?.data?.schedule_info?.selectedDays;
              let dayDate;
              if (preferred && Array.isArray(preferred) && preferred.length > 0) {
                const weekday = preferred[di % preferred.length];
                // compute offset from the base week start to the preferred weekday
                const offset = (weekday - baseWeekStart.getDay() + 7) % 7;
                dayDate = addDays(baseWeekStart, wi * 7 + offset);
              } else {
                dayDate = addDays(baseDate, wi * 7 + di);
              }
              // Only include tasks scheduled for today
              if (!isSameDay(dayDate, today)) continue;
              for (const topic of day.topics || []) {
                for (const activity of topic.activities || []) {
                  tasks.push({
                    id: `${p.id}-${week.week}-${day.day}-${topic.title}-${activity.description?.slice(0,20)}`,
                    planId: p.id,
                    planTitle: p.title,
                    planOverview: content.overview || '',
                    planSourceText: full?.data?.source_text || '',
                    week: week.week,
                    day: day.day,
                    topic: topic.title,
                    activity: activity,
                    date: dayDate,
                  });
                  if (tasks.length >= 6) break;
                }
                if (tasks.length >= 6) break;
              }
              if (tasks.length >= 6) break;
            }
            if (tasks.length >= 6) break;
          }
        } catch (err) {
          console.error("Failed loading plan details for tasks", p.id, err);
          continue;
        }
        if (tasks.length >= 6) break;
      }

      if (mounted) setUpcomingTasks(tasks.slice(0, 6));
    };

    loadUpcoming();

    return () => {
      mounted = false;
    };
  }, [studyPlans]);

  // Helper: get icon component for activity type/tool
  const getActivityIcon = (type, tool) => {
    switch (type) {
      case "tool":
        switch (tool) {
          case "flashcards":
            return <BrainCircuit className="h-4 w-4" />;
          case "quiz":
          case "practice_test":
            return <BookMarked className="h-4 w-4" />;
          case "summarizer":
            return <Zap className="h-4 w-4" />;
          case "voice_notes":
            return <Mic className="h-4 w-4" />;
          case "mind_maps":
            return <Network className="h-4 w-4" />;
          default:
            return <BookOpen className="h-4 w-4" />;
        }
      case "reading":
        return <BookOpen className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const getPriorityColorClass = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-orange-400";
      case "low":
        return "bg-blue-500";
      default:
        return "bg-gray-400";
    }
  };

  const getPriorityBgClass = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-50";
      case "medium":
        return "bg-orange-50";
      case "low":
        return "bg-blue-50";
      default:
        return "bg-gray-50";
    }
  };

  const getPriorityBorderClass = (priority) => {
    switch (priority) {
      case "high":
        return "border-l-4 border-red-500";
      case "medium":
        return "border-l-4 border-orange-400";
      case "low":
        return "border-l-4 border-blue-500";
      default:
        return "border-l-4 border-gray-300";
    }
  };

  // Deterministic per-plan color: derive a vivid hex color from plan id using HSL
  const hslToHex = (h, s, l) => {
    // h in [0,360], s,l in [0,100]
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hh = h / 60;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    let r1 = 0, g1 = 0, b1 = 0;
    if (hh >= 0 && hh < 1) { r1 = c; g1 = x; b1 = 0; }
    else if (hh >= 1 && hh < 2) { r1 = x; g1 = c; b1 = 0; }
    else if (hh >= 2 && hh < 3) { r1 = 0; g1 = c; b1 = x; }
    else if (hh >= 3 && hh < 4) { r1 = 0; g1 = x; b1 = c; }
    else if (hh >= 4 && hh < 5) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    const m = l - c / 2;
    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);
    const toHex = (v) => ('0' + (v & 0xff).toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const getPlanColor = (planId) => {
    if (!planId) return '#7c3aed';
    // simple hash to deterministically derive a hue
    let hash = 0;
    for (let i = 0; i < planId.length; i++) {
      hash = planId.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
    }
    const hue = Math.abs(hash) % 360;
    // choose high saturation and medium lightness for vivid colors
    const saturation = 72; // percent
    const lightness = 48; // percent
    return hslToHex(hue, saturation, lightness);
  };

  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    if (h.length === 6) {
      return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    }
    // fallback
    return [124, 58, 237];
  };

  const rgbaFromHex = (hex, alpha = 0.08) => {
    try {
      const [r, g, b] = hexToRgb(hex);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch (e) {
      return `rgba(124,58,237,${alpha})`;
    }
  };

  const getContrastTextColor = (hex) => {
    const [r, g, b] = hexToRgb(hex);
    // luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#000000' : '#ffffff';
  };


  // Build a comprehensive task list for calendar rendering from all plans (limit to first 20 plans)
  useEffect(() => {
    let mounted = true;
    const loadAllTasks = async () => {
      if (!studyPlans || studyPlans.length === 0) {
        if (mounted) setAllPlanTasks([]);
        return;
      }

      const tasks = [];
      const plansToLoad = studyPlans.slice(0, 20);

      // Fetch full plan details in parallel with graceful error handling
      const promises = plansToLoad.map((p) =>
        getStudyPlan(p.id).then((full) => ({ planMeta: p, full })).catch((e) => {
          console.warn("Failed fetching plan details", p.id, e);
          return null;
        })
      );

      const results = await Promise.all(promises);

      for (const res of results) {
        if (!res) continue;
        const p = res.planMeta;
        const full = res.full;
        const content = full?.data?.content;
        if (!content || !content.weekly_schedule) continue;

        // Map plan days to calendar dates. If the user provided schedule_info.selectedDays
        // (array of weekday numbers 0-6), map day slots into those weekdays each week.
        const baseDate = p.createdAt ? new Date(p.createdAt) : new Date();
        const preferred = full?.data?.schedule_info?.selectedDays;
        const weeks = content.weekly_schedule || [];
        for (let wi = 0; wi < weeks.length; wi++) {
          const week = weeks[wi];
          const days = week.days || [];
          for (let di = 0; di < days.length; di++) {
            const day = days[di];
            let dayDate;
            if (preferred && Array.isArray(preferred) && preferred.length > 0) {
              const weekday = preferred[di % preferred.length];
              const baseWeekStart = startOfWeek(baseDate);
              const baseWeekday = baseWeekStart.getDay();
              const daysUntilTarget = (weekday - baseWeekday + 7) % 7;
              dayDate = addDays(baseWeekStart, wi * 7 + daysUntilTarget);
            } else {
              dayDate = addDays(baseDate, wi * 7 + di);
            }
            for (const topic of day.topics || []) {
              for (const activity of topic.activities || []) {
                tasks.push({
                  id: `${p.id}-${week.week}-${day.day}-${topic.title}-${activity.description?.slice(0,20)}`,
                  planId: p.id,
                  planTitle: p.title,
                  planOverview: content.overview || '',
                  planSourceText: full?.data?.source_text || '',
                  week: week.week,
                  day: day.day,
                  topic: topic.title,
                  activity: activity,
                  date: dayDate,
                });
              }
            }
          }
        }
      }

      if (mounted) setAllPlanTasks(tasks);
    };

    loadAllTasks();

    return () => {
      mounted = false;
    };
  }, [studyPlans]);

  // This week's goals: plans updated or created within last 7 days, or newest plans if none
  const thisWeeksGoals = useMemo(() => {
    if (!studyPlans || studyPlans.length === 0) return [];
    const weekAgo = subDays(new Date(), 7);
    const recent = studyPlans.filter((p) => {
      const d = p.updatedAt || p.createdAt;
      if (!d) return false;
      return isWithinInterval(new Date(d), { start: weekAgo, end: new Date() });
    });
    if (recent.length > 0) return recent;
    return studyPlans.slice().sort((a, b) => new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt)).slice(0, 5);
  }, [studyPlans]);

  // Objectives view state: 'daily' | 'weekly' | 'monthly'
  const [objectivesView, setObjectivesView] = useState('weekly');
  const [selectedPlanFilterId, setSelectedPlanFilterId] = useState(null);

  // Daily goals: tasks scheduled for today (use upcomingTasks which was limited to today tasks)
  const dailyGoals = useMemo(() => {
    if (!upcomingTasks) return [];
    return upcomingTasks.filter((t) => isSameDay(new Date(t.date), today));
  }, [upcomingTasks]);

  // Weekly tasks: tasks scheduled for the current week
  const weekTasks = useMemo(() => {
    const start = startOfWeek(today);
    const end = endOfWeek(today);
    return (allPlanTasks || []).filter((t) => t.date && isWithinInterval(new Date(t.date), { start, end }));
  }, [allPlanTasks]);

  // Monthly tasks: tasks scheduled for the current calendar month
  const monthTasks = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return (allPlanTasks || []).filter((t) => t.date && isWithinInterval(new Date(t.date), { start, end }));
  }, [allPlanTasks, currentMonth]);

  // Default selected plan filter: set to first plan when plans load
  useEffect(() => {
    // Only auto-select if we have plans and no selection yet
    if ((!selectedPlanFilterId || selectedPlanFilterId === '') && studyPlans && studyPlans.length > 0) {
      setSelectedPlanFilterId(studyPlans[0].id);
    }
  }, [studyPlans, selectedPlanFilterId]);

  // Apply plan filter to task lists when a plan is selected
  const filteredDailyGoals = useMemo(() => {
    // If no plan is selected, show tasks from all plans; otherwise filter by selected plan
    if (!selectedPlanFilterId || selectedPlanFilterId === '') {
      return dailyGoals;
    }
    return dailyGoals.filter((t) => t.planId === selectedPlanFilterId);
  }, [dailyGoals, selectedPlanFilterId]);

  const filteredWeekTasks = useMemo(() => {
    if (!selectedPlanFilterId || selectedPlanFilterId === '') {
      return weekTasks;
    }
    return weekTasks.filter((t) => t.planId === selectedPlanFilterId);
  }, [weekTasks, selectedPlanFilterId]);

  const filteredMonthTasks = useMemo(() => {
    if (!selectedPlanFilterId || selectedPlanFilterId === '') {
      return monthTasks;
    }
    return monthTasks.filter((t) => t.planId === selectedPlanFilterId);
  }, [monthTasks, selectedPlanFilterId]);


  // Monthly goals: plans created/updated this month or recent plans if none
  const monthlyGoals = useMemo(() => {
    if (!studyPlans || studyPlans.length === 0) return [];
    const inMonth = studyPlans.filter((p) => {
      const d = p.updatedAt || p.createdAt;
      if (!d) return false;
      return isSameMonth(new Date(d), currentMonth);
    });
    if (inMonth.length > 0) return inMonth;
    return studyPlans.slice().sort((a, b) => new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt)).slice(0, 5);
  }, [studyPlans, currentMonth]);

  // Calendar days for current month and mark days with any plan activity
  // interactive calendar state
  

  // compute calendar matrix for current month (includes previous/next month padding)
  const calendarMatrix = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    const days = [];
    let cursor = start;
    while (cursor <= end) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    // map days to objects with hasActivity
    return days.map((d) => ({
      date: d,
      isCurrentMonth: isSameMonth(d, currentMonth),
      // use the full set of mapped plan tasks for calendar markers
      hasActivity: allPlanTasks.some((t) => t.date && isSameDay(new Date(t.date), d)),
      // collect priorities for coloring the dot(s)
      priorities: Array.from(new Set((allPlanTasks || []).filter((t) => t.date && isSameDay(new Date(t.date), d)).map((t) => t.activity.priority || "default")).values()),
    }));
  }, [currentMonth, studyPlans, allPlanTasks]);

  const goPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const goNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

  const plansForDate = (date) => {
    if (!date) return [];
    return studyPlans.filter((p) => {
      const dstr = p.updatedAt || p.createdAt;
      if (!dstr) return false;
      return isSameDay(new Date(dstr), date);
    });
  };

  // Tasks scheduled for a given date (derived from upcomingTasks)
  const tasksForDate = (date) => {
    if (!date) return [];
    return (allPlanTasks || []).filter((t) => t.date && isSameDay(new Date(t.date), date));
  };

  // Quick access stats
  const stats = useMemo(() => {
    const totalPlans = studyPlans.length;
    const lastPlan = studyPlans.slice().sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0];
    return { totalPlans, lastPlan };
  }, [studyPlans, today]);

  // Render the planner home view
  const renderPlannerHome = () => (
    <div>
      <div className="grid grid-cols-12 gap-6">
      {/* Left navigation */}
      <aside className="col-span-2 hidden lg:block">
        <div className="sticky top-6 space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-3 text-sky-700 font-bold">
              <span className="text-2xl">📚</span>
              <span>My Plans</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h4 className="text-sm font-semibold">Your Plans</h4>
            <div className="mt-2 space-y-2 text-sm">
              {studyPlans.length === 0 ? (
                <div className="text-gray-500">No saved plans</div>
              ) : (
                studyPlans.slice(0, 8).map((p) => {
                  const planColor = getPlanColor(p.id);
                  const bg = rgbaFromHex(planColor, 0.12);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPlan(p)}
                      className="w-full text-left flex items-center justify-between p-2 rounded hover:opacity-95"
                      style={{ backgroundColor: bg, color: '#000000', border: '1px solid rgba(0,0,0,0.04)' }}
                    >
                      <div className="truncate">{p.title}</div>
                      <div className="text-xs text-gray-400">{p.updatedAt ? format(new Date(p.updatedAt), 'MMM d') : (p.createdAt ? format(new Date(p.createdAt),'MMM d') : '')}</div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="col-span-12 lg:col-span-7">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">My Learning Path</h1>
            <p className="text-sm text-gray-600">Your Personalized Roadmap to Success</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search plans..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearchDropdown(true); }}
                onFocus={() => setShowSearchDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const first = (filteredPlans && filteredPlans[0]) || null;
                    if (first) {
                      handleSelectPlan(first);
                      setSearchQuery('');
                      setShowSearchDropdown(false);
                    }
                  } else if (e.key === 'Escape') {
                    setShowSearchDropdown(false);
                  }
                }}
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-primary-500"
              />
              <Search className="absolute left-3 top-2 h-4 w-4 text-gray-400" />

              {showSearchDropdown && searchQuery && filteredPlans && filteredPlans.length > 0 && (
                <div className="absolute left-0 mt-1 w-96 max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  {filteredPlans.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      onMouseDown={(ev) => { ev.preventDefault(); /* prevent input blur */ }}
                      onClick={() => { handleSelectPlan(p); setSearchQuery(''); setShowSearchDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="truncate text-sm">{p.title}</div>
                      <div className="text-xs text-gray-400 ml-2">{p.updatedAt ? format(new Date(p.updatedAt), 'MMM d') : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleCreatePlan}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
            >
              <PlusCircle className="h-5 w-5" />
              New plan
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Immediate Tasks card */}
          <section className="md:col-span-3 bg-sky-50 p-6 rounded-lg shadow-sm border border-sky-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">Immediate Tasks <span className="ml-2">⚡</span></h3>
                <p className="text-sm text-sky-700">Things to do next based on your saved study plans</p>
              </div>
              <div className="text-sm text-sky-600">Next up</div>
            </div>

            <div className="space-y-3">
              {(!upcomingTasks || upcomingTasks.length === 0) ? (
                (studyPlans && studyPlans.length > 0) ? (
                  <div className="text-sky-500">No tasks for the day.</div>
                ) : (
                  <div className="text-sky-500">No tasks yet. Create a plan to get suggested tasks.</div>
                )
              ) : (
                upcomingTasks.map((t) => {
                  const priority = t.activity.priority || "default";
                  const planColor = getPlanColor(t.planId);
                  const bgColor = rgbaFromHex(planColor, 0.08);
                  return (
                  <label key={t.id} className={`flex items-center justify-between p-3 rounded-md shadow-sm`} style={{ backgroundColor: bgColor, borderLeft: `4px solid ${planColor}` }}>
                    <div className="flex items-start gap-3 min-w-0">
                      <input type="checkbox" className="mt-1 h-4 w-4 text-sky-600" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`flex-shrink-0 p-1 rounded ${getPriorityColorClass(priority)} text-white`}>
                            {getActivityIcon(t.activity.type, t.activity.tool)}
                          </span>
                          <div className="font-medium text-gray-800 truncate">
                            {t.activity.title || t.activity.description || `${t.activity.type}`}
                          </div>
                        </div>
                        {t.activity.description && (
                          <div className="text-xs text-gray-500 mt-1 whitespace-normal break-words">{t.activity.description}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">Plan: {t.planTitle} • Week {t.week} • Day {t.day}</div>
                      </div>
                    </div>
                      <div className="flex-shrink-0 ml-3 flex flex-col items-end gap-2">
                      <button onClick={() => handleSelectPlan({ id: t.planId })} className="text-primary-600 text-sm">Open Plan</button>
                        {(() => {
                        const title = (t.activity && t.activity.title) || "";
                        const desc = (t.activity && t.activity.description) || "";
                        const tool = (t.activity && t.activity.tool) || "";
                        const isSummarize = (tool && tool.toLowerCase() === 'summarizer') || /summarize/i.test(title) || /summarize/i.test(desc);
                        const isQuizLike = (tool && (tool.toLowerCase() === 'quiz' || tool.toLowerCase() === 'practice_test')) || /test|quiz|practice/i.test(`${title} ${desc}`);
                        const isFlashcards = (tool && tool.toLowerCase() === 'flashcards') || /flashcard|flash cards|create flash/i.test(`${title} ${desc}`);
                        const isRecord = (tool && tool.toLowerCase() === 'voice_notes') || /record|voice note|audio note/i.test(`${title} ${desc}`);

                        return (
                          <>
                            {isSummarize ? (
                              <button
                                onClick={() => navigate('/tools/summarizer', { state: { summarizeText: t.planSourceText || '' } })}
                                className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600"
                              >
                                Summarize
                              </button>
                            ) : (
                              <div className="text-xs text-gray-500 capitalize">{priority}</div>
                            )}

                            {isRecord && (
                              <button
                                onClick={() => navigate('/tools/voice-notes', { state: { noteTitle: t.activity.title || t.activity.description || 'Voice Note' } })}
                                className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50"
                              >
                                Record
                              </button>
                            )}

                            {isQuizLike && (
                              <button
                                onClick={async () => {
                                  try {
                                    // Build combined text for quiz generation
                                    const text = t.planSourceText || '';
                                    const file = new File([text], 'task-for-quiz.txt', { type: 'text/plain' });
                                    // default parameters
                                    const numQuestions = 10;
                                    const selectedTopics = [];
                                    const customTopics = '';
                                    const questionFormats = { multiple_choice: true };

                                    const quizData = await generateQuiz(file, numQuestions, selectedTopics, customTopics, questionFormats);
                                    // Navigate to Practice Tests with generated quiz in location state
                                    navigate('/tools/practice-tests', { state: { generatedQuiz: quizData } });
                                  } catch (err) {
                                    console.error('Failed to generate quiz from task', err);
                                    alert('Failed to generate quiz: ' + (err.message || err));
                                  }
                                }}
                                className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
                              >
                                Test your knowledge
                              </button>
                            )}

                            {isFlashcards && (
                              <button
                                onClick={async () => {
                                  try {
                                    const text = t.planSourceText || '';
                                    const file = new File([text], 'task-for-flashcards.txt', { type: 'text/plain' });
                                    const numCards = 10;
                                    const flashData = await generateFlashcards(file, numCards);
                                    navigate('/tools/ai-flashcards', { state: { generatedDeck: flashData } });
                                  } catch (err) {
                                    console.error('Failed to generate flashcards from task', err);
                                    alert('Failed to generate flashcards: ' + (err.message || err));
                                  }
                                }}
                                className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-purple-200 bg-white text-purple-700 hover:bg-purple-50"
                              >
                                Create flash cards
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </label>
                )})
              )}
            </div>
          </section>
          
          {/* Right column placeholder (kept empty on small screens) */}
          <aside className="space-y-6">
            {/* Right column content (Quick Access, Recent Activity, etc.) lives in the right-side aside below outside this grid cell */}
          </aside>
        </div>

        {/* Objectives & Tasks moved below Immediate Tasks as its own card */}
        <div className="mt-4">
          <section className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Objectives and Tasks</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setObjectivesView('daily')}
                  className={`px-2 py-1 text-xs rounded-md ${objectivesView === 'daily' ? 'bg-sky-100 text-sky-700 font-medium' : 'bg-gray-100 text-gray-700'}`}>
                  Daily
                </button>
                <button
                  onClick={() => setObjectivesView('weekly')}
                  className={`px-2 py-1 text-xs rounded-md ${objectivesView === 'weekly' ? 'bg-sky-100 text-sky-700 font-medium' : 'bg-gray-100 text-gray-700'}`}>
                  Weekly
                </button>
                <button
                  onClick={() => setObjectivesView('monthly')}
                  className={`px-2 py-1 text-xs rounded-md ${objectivesView === 'monthly' ? 'bg-sky-100 text-sky-700 font-medium' : 'bg-gray-100 text-gray-700'}`}>
                  Monthly
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">This Week's Goals</h4>
              <div className="space-y-3">
                {/* Plan filter buttons */}
                <div className="mb-3 flex items-center gap-2 overflow-x-auto">
                  {studyPlans && studyPlans.length > 0 ? (
                    studyPlans.slice(0, 8).map((p) => {
                      const planColor = getPlanColor(p.id);
                      const bg = rgbaFromHex(planColor, 0.14);
                      const textColor = getContrastTextColor(planColor);
                      const selected = selectedPlanFilterId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPlanFilterId(p.id)}
                          className={`px-3 py-1 rounded-full text-sm font-medium border ${selected ? 'ring-2 ring-sky-300' : 'hover:opacity-90'}`}
                          style={{ backgroundColor: bg, color: '#000000', borderColor: 'rgba(0,0,0,0.04)' }}
                        >
                          {p.title}
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-gray-400 text-sm">No plans to filter</div>
                  )}
                </div>
                {objectivesView === 'daily' ? (
                  (filteredDailyGoals.length === 0) ? (
                    <div className="text-gray-500 text-sm">No daily tasks — create or schedule activities to get suggestions.</div>
                  ) : (
                    filteredDailyGoals.map((t) => {
                      const priority = t.activity.priority || "default";
                      const planColor = getPlanColor(t.planId);
                      const bgColor = rgbaFromHex(planColor, 0.08);
                      return (
                        <label key={t.id} className={`flex items-center justify-between p-3 rounded-md shadow-sm`} style={{ backgroundColor: bgColor, borderLeft: `4px solid ${planColor}` }}>
                          <div className="flex items-start gap-3 min-w-0">
                            <input type="checkbox" className="mt-1 h-4 w-4 text-sky-600" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`flex-shrink-0 p-1 rounded ${getPriorityColorClass(priority)} text-white`}>
                                  {getActivityIcon(t.activity.type, t.activity.tool)}
                                </span>
                                <div className="font-medium text-gray-800 truncate">
                                  {t.activity.title || t.activity.description || `${t.activity.type}`}
                                </div>
                              </div>
                              {t.activity.description && (
                                <div className="text-xs text-gray-500 mt-1 whitespace-normal break-words">{t.activity.description}</div>
                              )}
                              <div className="text-xs text-gray-400 mt-1">Plan: {t.planTitle} • Week {t.week} • Day {t.day}</div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-3 flex flex-col items-end gap-2">
                            <button onClick={() => handleSelectPlan({ id: t.planId })} className="text-primary-600 text-sm">Open Plan</button>
                            {(() => {
                              const title = (t.activity && t.activity.title) || "";
                              const desc = (t.activity && t.activity.description) || "";
                              const tool = (t.activity && t.activity.tool) || "";
                              const isSummarize = (tool && tool.toLowerCase() === 'summarizer') || /summarize/i.test(title) || /summarize/i.test(desc);
                              const isQuizLike = (tool && (tool.toLowerCase() === 'quiz' || tool.toLowerCase() === 'practice_test')) || /test|quiz|practice/i.test(`${title} ${desc}`);
                              const isFlashcards = (tool && tool.toLowerCase() === 'flashcards') || /flashcard|flash cards|create flash/i.test(`${title} ${desc}`);
                              const isRecord = (tool && tool.toLowerCase() === 'voice_notes') || /record|voice note|audio note/i.test(`${title} ${desc}`);
                              return (
                                <>
                                  {isSummarize ? (
                                    <button
                                      onClick={() => navigate('/tools/summarizer', { state: { summarizeText: t.planSourceText || '' } })}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600"
                                    >
                                      Summarize
                                    </button>
                                  ) : (
                                    <div className="text-xs text-gray-500 capitalize">{priority}</div>
                                  )}

                                  {isRecord && (
                                    <button
                                      onClick={() => navigate('/tools/voice-notes', { state: { noteTitle: t.activity.title || t.activity.description || 'Voice Note' } })}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50"
                                    >
                                      Record
                                    </button>
                                  )}

                                  {isQuizLike && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const text = t.planSourceText || '';
                                          const file = new File([text], 'task-for-quiz.txt', { type: 'text/plain' });
                                          const numQuestions = 10;
                                          const selectedTopics = [];
                                          const customTopics = '';
                                          const questionFormats = { multiple_choice: true };
                                          const quizData = await generateQuiz(file, numQuestions, selectedTopics, customTopics, questionFormats);
                                          navigate('/tools/practice-tests', { state: { generatedQuiz: quizData } });
                                        } catch (err) {
                                          console.error('Failed to generate quiz from task', err);
                                          alert('Failed to generate quiz: ' + (err.message || err));
                                        }
                                      }}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
                                    >
                                      Test your knowledge
                                    </button>
                                  )}

                                  {isFlashcards && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const text = t.planSourceText || '';
                                          const file = new File([text], 'task-for-flashcards.txt', { type: 'text/plain' });
                                          const numCards = 10;
                                          const flashData = await generateFlashcards(file, numCards);
                                          navigate('/tools/ai-flashcards', { state: { generatedDeck: flashData } });
                                        } catch (err) {
                                          console.error('Failed to generate flashcards from task', err);
                                          alert('Failed to generate flashcards: ' + (err.message || err));
                                        }
                                      }}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-purple-200 bg-white text-purple-700 hover:bg-purple-50"
                                    >
                                      Create flash cards
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </label>
                      );
                    })
                  )
                ) : objectivesView === 'monthly' ? (
                  (filteredMonthTasks.length === 0) ? (
                    <div className="text-gray-500 text-sm">No tasks this month — create or schedule activities to get suggestions.</div>
                  ) : (
                    filteredMonthTasks.map((t) => {
                      const priority = t.activity.priority || "default";
                      const planColor = getPlanColor(t.planId);
                      const bgColor = rgbaFromHex(planColor, 0.08);
                      return (
                        <label key={t.id} className={`flex items-center justify-between p-3 rounded-md shadow-sm`} style={{ backgroundColor: bgColor, borderLeft: `4px solid ${planColor}` }}>
                          <div className="flex items-start gap-3 min-w-0">
                            <input type="checkbox" className="mt-1 h-4 w-4 text-sky-600" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`flex-shrink-0 p-1 rounded ${getPriorityColorClass(priority)} text-white`}>
                                  {getActivityIcon(t.activity.type, t.activity.tool)}
                                </span>
                                <div className="font-medium text-gray-800 truncate">
                                  {t.activity.title || t.activity.description || `${t.activity.type}`}
                                </div>
                              </div>
                              {t.activity.description && (
                                <div className="text-xs text-gray-500 mt-1 whitespace-normal break-words">{t.activity.description}</div>
                              )}
                              <div className="text-xs text-gray-400 mt-1">Plan: {t.planTitle} • Week {t.week} • Day {t.day}</div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-3 flex flex-col items-end gap-2">
                            <button onClick={() => handleSelectPlan({ id: t.planId })} className="text-primary-600 text-sm">Open Plan</button>
                            {(() => {
                              const title = (t.activity && t.activity.title) || "";
                              const desc = (t.activity && t.activity.description) || "";
                              const tool = (t.activity && t.activity.tool) || "";
                              const isSummarize = (tool && tool.toLowerCase() === 'summarizer') || /summarize/i.test(title) || /summarize/i.test(desc);
                              const isQuizLike = (tool && (tool.toLowerCase() === 'quiz' || tool.toLowerCase() === 'practice_test')) || /test|quiz|practice/i.test(`${title} ${desc}`);
                              const isFlashcards = (tool && tool.toLowerCase() === 'flashcards') || /flashcard|flash cards|create flash/i.test(`${title} ${desc}`);
                              const isRecord = (tool && tool.toLowerCase() === 'voice_notes') || /record|voice note|audio note/i.test(`${title} ${desc}`);
                              return (
                                <>
                                  {isSummarize ? (
                                    <button
                                      onClick={() => navigate('/tools/summarizer', { state: { summarizeText: t.planSourceText || '' } })}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600"
                                    >
                                      Summarize
                                    </button>
                                  ) : (
                                    <div className="text-xs text-gray-500 capitalize">{priority}</div>
                                  )}

                                  {isRecord && (
                                    <button
                                      onClick={() => navigate('/tools/voice-notes', { state: { noteTitle: t.activity.title || t.activity.description || 'Voice Note' } })}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50"
                                    >
                                      Record
                                    </button>
                                  )}

                                  {isQuizLike && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const text = t.planSourceText || '';
                                          const file = new File([text], 'task-for-quiz.txt', { type: 'text/plain' });
                                          const numQuestions = 10;
                                          const selectedTopics = [];
                                          const customTopics = '';
                                          const questionFormats = { multiple_choice: true };
                                          const quizData = await generateQuiz(file, numQuestions, selectedTopics, customTopics, questionFormats);
                                          navigate('/tools/practice-tests', { state: { generatedQuiz: quizData } });
                                        } catch (err) {
                                          console.error('Failed to generate quiz from task', err);
                                          alert('Failed to generate quiz: ' + (err.message || err));
                                        }
                                      }}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
                                    >
                                      Test your knowledge
                                    </button>
                                  )}

                                  {isFlashcards && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const text = t.planSourceText || '';
                                          const file = new File([text], 'task-for-flashcards.txt', { type: 'text/plain' });
                                          const numCards = 10;
                                          const flashData = await generateFlashcards(file, numCards);
                                          navigate('/tools/ai-flashcards', { state: { generatedDeck: flashData } });
                                        } catch (err) {
                                          console.error('Failed to generate flashcards from task', err);
                                          alert('Failed to generate flashcards: ' + (err.message || err));
                                        }
                                      }}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-purple-200 bg-white text-purple-700 hover:bg-purple-50"
                                    >
                                      Create flash cards
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </label>
                      );
                    })
                  )
                ) : (
                  (filteredWeekTasks.length === 0) ? (
                    <div className="text-gray-500 text-sm">No tasks this week — create or schedule activities to get suggestions.</div>
                  ) : (
                    filteredWeekTasks.map((t) => {
                      const priority = t.activity.priority || "default";
                      const planColor = getPlanColor(t.planId);
                      const bgColor = rgbaFromHex(planColor, 0.08);
                      return (
                        <label key={t.id} className={`flex items-center justify-between p-3 rounded-md shadow-sm`} style={{ backgroundColor: bgColor, borderLeft: `4px solid ${planColor}` }}>
                          <div className="flex items-start gap-3 min-w-0">
                            <input type="checkbox" className="mt-1 h-4 w-4 text-sky-600" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`flex-shrink-0 p-1 rounded ${getPriorityColorClass(priority)} text-white`}>
                                  {getActivityIcon(t.activity.type, t.activity.tool)}
                                </span>
                                <div className="font-medium text-gray-800 truncate">
                                  {t.activity.title || t.activity.description || `${t.activity.type}`}
                                </div>
                              </div>
                              {t.activity.description && (
                                <div className="text-xs text-gray-500 mt-1 whitespace-normal break-words">{t.activity.description}</div>
                              )}
                              <div className="text-xs text-gray-400 mt-1">Plan: {t.planTitle} • Week {t.week} • Day {t.day}</div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-3 flex flex-col items-end gap-2">
                            <button onClick={() => handleSelectPlan({ id: t.planId })} className="text-primary-600 text-sm">Open Plan</button>
                            {(() => {
                              const title = (t.activity && t.activity.title) || "";
                              const desc = (t.activity && t.activity.description) || "";
                              const tool = (t.activity && t.activity.tool) || "";
                              const isSummarize = (tool && tool.toLowerCase() === 'summarizer') || /summarize/i.test(title) || /summarize/i.test(desc);
                              const isQuizLike = (tool && (tool.toLowerCase() === 'quiz' || tool.toLowerCase() === 'practice_test')) || /test|quiz|practice/i.test(`${title} ${desc}`);
                              const isFlashcards = (tool && tool.toLowerCase() === 'flashcards') || /flashcard|flash cards|create flash/i.test(`${title} ${desc}`);
                              const isRecord = (tool && tool.toLowerCase() === 'voice_notes') || /record|voice note|audio note/i.test(`${title} ${desc}`);
                              return (
                                <>
                                  {isSummarize ? (
                                    <button
                                      onClick={() => navigate('/tools/summarizer', { state: { summarizeText: t.planSourceText || '' } })}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600"
                                    >
                                      Summarize
                                    </button>
                                  ) : (
                                    <div className="text-xs text-gray-500 capitalize">{priority}</div>
                                  )}

                                  {isRecord && (
                                    <button
                                      onClick={() => navigate('/tools/voice-notes', { state: { noteTitle: t.activity.title || t.activity.description || 'Voice Note' } })}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50"
                                    >
                                      Record
                                    </button>
                                  )}

                                  {isQuizLike && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const text = t.planSourceText || '';
                                          const file = new File([text], 'task-for-quiz.txt', { type: 'text/plain' });
                                          const numQuestions = 10;
                                          const selectedTopics = [];
                                          const customTopics = '';
                                          const questionFormats = { multiple_choice: true };
                                          const quizData = await generateQuiz(file, numQuestions, selectedTopics, customTopics, questionFormats);
                                          navigate('/tools/practice-tests', { state: { generatedQuiz: quizData } });
                                        } catch (err) {
                                          console.error('Failed to generate quiz from task', err);
                                          alert('Failed to generate quiz: ' + (err.message || err));
                                        }
                                      }}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
                                    >
                                      Test your knowledge
                                    </button>
                                  )}

                                  {isFlashcards && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const text = t.planSourceText || '';
                                          const file = new File([text], 'task-for-flashcards.txt', { type: 'text/plain' });
                                          const numCards = 10;
                                          const flashData = await generateFlashcards(file, numCards);
                                          navigate('/tools/ai-flashcards', { state: { generatedDeck: flashData } });
                                        } catch (err) {
                                          console.error('Failed to generate flashcards from task', err);
                                          alert('Failed to generate flashcards: ' + (err.message || err));
                                        }
                                      }}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-purple-200 bg-white text-purple-700 hover:bg-purple-50"
                                    >
                                      Create flash cards
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </label>
                      );
                    })
                  )
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Saved plans list below */}
        <div className="mt-6">
          <SavedStudyPlansList plans={filteredPlans} onSelectPlan={handleSelectPlan} refreshPlans={fetchStudyPlans} />
        </div>
      </main>

      {/* Right column: quick access */}
      <aside className="col-span-12 lg:col-span-3">
        <div className="sticky top-6 space-y-4">
          {/* Right column now shows only Recent Activity for quick access */}

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h4 className="text-sm font-semibold">Recent Activity</h4>
            <div className="mt-2 space-y-2 text-xs text-gray-600">
              {studyPlans.slice(0,5).map((p)=>(
                <div key={p.id} className="flex items-center justify-between">
                  <div>{p.title}</div>
                  <div className="text-gray-400">{p.updatedAt ? format(new Date(p.updatedAt),'MMM d') : (p.createdAt ? format(new Date(p.createdAt),'MMM d') : '')}</div>
                </div>
              ))}
              {studyPlans.length === 0 && <div className="text-gray-500">No activity yet</div>}
            </div>
          </div>
        </div>
      </aside>

    </div>

    {/* Full-width calendar container */}
    <div className="col-span-12 mt-8">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Study Calendar</h3>
            <div className="text-sm text-gray-500">{format(currentMonth, 'MMMM yyyy')}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goPrevMonth} className="px-3 py-1 border rounded hover:bg-gray-50">Prev</button>
            <button onClick={goNextMonth} className="px-3 py-1 border rounded hover:bg-gray-50">Next</button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="grid grid-cols-7 gap-3 text-sm mb-3">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                <div key={d} className="text-center text-gray-500 font-medium">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-3">
              {calendarMatrix.map((cell) => (
                <button
                  key={cell.date.toISOString()}
                  onClick={() => setSelectedDate(cell.date)}
                  className={`h-24 p-3 border rounded-lg flex flex-col justify-between text-left ${cell.isCurrentMonth ? '' : 'opacity-40'} ${isSameDay(cell.date, selectedDate || new Date(0)) ? 'ring-2 ring-primary-500' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="text-sm text-gray-700 font-medium">{format(cell.date, 'd')}</div>
                    <div className="flex items-center gap-1">
                      {cell.priorities && cell.priorities.length > 0 ? (
                        cell.priorities.slice(0,3).map((p, idx) => (
                          <span key={idx} className={`inline-block w-2 h-2 rounded-full ${getPriorityColorClass(p)}`} aria-hidden="true" />
                        ))
                      ) : (
                        <div className="text-xs text-gray-500">{cell.hasActivity ? '●' : ''}</div>
                      )}
                    </div>
                  </div>
                      <div className="text-xs text-gray-600 mt-2">
                        {/* Show no previews here — calendar squares only show colored dot(s). */}
                        {/* Tasks are visible in the side panel when a date is selected. */}
                      </div>
                </button>
              ))}
            </div>
          </div>

          <div className="w-full lg:w-1/3">
            <div className="bg-gray-50 p-4 rounded-lg h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">{selectedDate ? format(selectedDate,'MMMM d, yyyy') : 'Select a date'}</div>
                {selectedDate && <button onClick={() => setSelectedDate(null)} className="text-xs text-gray-500">Clear</button>}
              </div>
              <div className="space-y-3 mt-3">
                {selectedDate ? (
                  tasksForDate(selectedDate).length === 0 ? (
                    <div className="text-gray-500">No tasks on this date</div>
                  ) : (
                    tasksForDate(selectedDate).map((t) => (
                      <div key={t.id} className="p-3 rounded flex items-start gap-3 min-w-0" style={{ backgroundColor: rgbaFromHex(getPlanColor(t.planId), 0.08), borderLeft: `4px solid ${getPlanColor(t.planId)}` }}>
                            <div className={`p-2 rounded`}>
                              <span className={`flex-shrink-0 ${getPriorityColorClass(t.activity.priority || 'default')} text-white p-1 rounded`}>{getActivityIcon(t.activity.type, t.activity.tool)}</span>
                            </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium text-sm truncate min-w-0 overflow-hidden">{t.activity.title || t.activity.description || t.planTitle}</div>
                              <div className="text-xs text-gray-400 capitalize flex-shrink-0">{t.activity.priority || 'normal'}</div>
                            </div>
                            {t.activity.description && <div className="text-xs text-gray-500 mt-1 whitespace-normal break-words">{t.activity.description}</div>}
                            <div className="text-xs text-gray-400 mt-1">Plan: {t.planTitle} • Week {t.week} • Day {t.day}</div>
                          </div>
                          <div className="flex-shrink-0 ml-3 flex flex-col items-end gap-2">
                            <button onClick={() => handleSelectPlan({ id: t.planId })} className="text-primary-600 text-sm">Open Plan</button>
                            {(() => {
                              const title = (t.activity && t.activity.title) || "";
                              const desc = (t.activity && t.activity.description) || "";
                              const tool = (t.activity && t.activity.tool) || "";
                              const isSummarize = (tool && tool.toLowerCase() === 'summarizer') || /summarize/i.test(title) || /summarize/i.test(desc);
                              const isQuizLike = (tool && (tool.toLowerCase() === 'quiz' || tool.toLowerCase() === 'practice_test')) || /test|quiz|practice/i.test(`${title} ${desc}`);
                              const isFlashcards = (tool && tool.toLowerCase() === 'flashcards') || /flashcard|flash cards|create flash/i.test(`${title} ${desc}`);
                              const isRecord = (tool && tool.toLowerCase() === 'voice_notes') || /record|voice note|audio note/i.test(`${title} ${desc}`);
                              return (
                                <>
                                  {isSummarize ? (
                                    <button
                                        onClick={() => navigate('/tools/summarizer', { state: { summarizeText: t.planSourceText || '' } })}
                                        className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-transparent bg-sky-50 text-sky-700 hover:bg-sky-100"
                                      >
                                        Summarize
                                      </button>
                                  ) : null}

                                  {isRecord && (
                                    <button
                                      onClick={() => navigate('/tools/voice-notes', { state: { noteTitle: t.activity.title || t.activity.description || 'Voice Note' } })}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50"
                                    >
                                      Record
                                    </button>
                                  )}

                                  {isQuizLike && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          setLoadingQuizTaskId(t.id);
                                          const text = t.planSourceText || '';
                                          const file = new File([text], 'task-for-quiz.txt', { type: 'text/plain' });
                                          const numQuestions = 10;
                                          const selectedTopics = [];
                                          const customTopics = '';
                                          const questionFormats = { multiple_choice: true };
                                          const quizData = await generateQuiz(file, numQuestions, selectedTopics, customTopics, questionFormats);
                                          navigate('/tools/practice-tests', { state: { generatedQuiz: quizData } });
                                        } catch (err) {
                                          console.error('Failed to generate quiz from task', err);
                                          alert('Failed to generate quiz: ' + (err.message || err));
                                          setLoadingQuizTaskId(null);
                                        }
                                      }}
                                      disabled={loadingQuizTaskId === t.id}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      {loadingQuizTaskId === t.id ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          Generating...
                                        </>
                                      ) : (
                                        'Test your knowledge'
                                      )}
                                    </button>
                                  )}

                                  {isFlashcards && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const text = t.planSourceText || '';
                                          const file = new File([text], 'task-for-flashcards.txt', { type: 'text/plain' });
                                          const numCards = 10;
                                          const flashData = await generateFlashcards(file, numCards);
                                          navigate('/tools/ai-flashcards', { state: { generatedDeck: flashData } });
                                        } catch (err) {
                                          console.error('Failed to generate flashcards from task', err);
                                          alert('Failed to generate flashcards: ' + (err.message || err));
                                        }
                                      }}
                                      className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-purple-200 bg-white text-purple-700 hover:bg-purple-50"
                                    >
                                      Create flash cards
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                    ))
                  )
                ) : (
                  <div className="text-sm text-gray-500">Click a day to see tasks scheduled there.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );

  // Main render method
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {showPlanner ? (
        renderPlannerHome()
      ) : showCreate ? (
        <StudyPlanWizard
          onBack={handleBack}
          onPlanCreated={(planResult) => {
            // planResult is the API response: { id, plan, message }
            // Set current plan to the saved plan id so StudyPlanDisplay can fetch full details
              if (planResult && planResult.id) {
              // If backend returned saved metadata, use it; otherwise, build optimistic entry
              const saved = planResult.saved;
              const entry = saved
                ? saved
                : {
                    id: planResult.id,
                    title: planResult.plan?.title || planResult.title || "New Plan",
                    description: planResult.plan?.description || planResult.description || "",
                    tags: planResult.plan?.tags || [],
                    createdAt: new Date().toISOString(),
                    updatedAt: planResult.plan?.updatedAt || null,
                  };
              setStudyPlans((prev) => [entry, ...(prev || [])]);
              const cp = { id: planResult.id };
              setCurrentPlan(cp);
              try {
                window.localStorage.setItem("selectedStudyPlanId", planResult.id);
              } catch (e) {
                /* ignore */
              }
            } else {
              setCurrentPlan(planResult);
            }
            setShowCreate(false);
            // Refresh the list so the new plan appears in SavedStudyPlansList (reconcile with server)
            fetchStudyPlans();
          }}
        />
      ) : currentPlan ? (
        <StudyPlanDisplay
          plan={currentPlan}
          onBack={handleBack}
          planStatus={planStatus}
          setPlanStatus={setPlanStatus}
        />
      ) : null}
    </div>
  );
};

export default StudyPlans;
