import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calculator,
  PlusCircle,
  Calendar,
  ChevronDown,
  CheckCircle2,
  Clock3,
  FlaskConical,
  MoreHorizontal,
  Play,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import {
    getStudyPlan,
    saveStudyPlan
} from "../../../api/apiService";
import StudyPlanActivities from "./StudyPlanActivities";
import StudyPlanWizard from "./StudyPlanWizard";
import StudyPlanDisplay from "./StudyPlanDisplay";

/**
 * Main StudyPlans component that coordinates all other components
 */
const StudyPlans = () => {
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("planId");

  // State for component display
  const [showCreate, setShowCreate] = useState(false);
  const [showPlanner, setShowPlanner] = useState(true);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [createdPlan, setCreatedPlan] = useState(null);
  const [planStatus, setPlanStatus] = useState("idle"); // idle, loading, ready, updating
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (!planId) {
      return;
    }

    let cancelled = false;

    const loadPlanFromQuery = async () => {
      try {
        const plan = await getStudyPlan(planId);
        if (cancelled) {
          return;
        }
        setCurrentPlan(plan);
        setShowPlanner(false);
        setShowCreate(false);
      } catch (err) {
        console.error("Error fetching study plan by id:", err);
      }
    };

    loadPlanFromQuery();

    return () => {
      cancelled = true;
    };
  }, [planId]);

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
  };

  const handlePlanCreated = async (plan) => {
  try {
    setPlanStatus("loading");

    const response = await saveStudyPlan(plan);

    const savedPlan = {
      ...response.plan,
      activities: response.plan.activities || [],
    };

    setCreatedPlan(savedPlan);

    setShowPlanner(true);
    setShowCreate(false);
    setPlanStatus("ready");
  } catch (error) {
    console.error("Failed to save study plan:", error);
    setPlanStatus("idle");

    alert("Failed to save study plan. Please try again.");
  }
};


  const handleAddActivity = (activity) => {
    setCreatedPlan((plan) =>
      plan
        ? { ...plan, activities: [...(plan.activities || []), activity] }
        : plan
    );
  };

  const handleToggleActivity = (activityId) => {
    setCreatedPlan((plan) =>
      plan
        ? {
            ...plan,
            activities: (plan.activities || []).map((activity) =>
              activity.id === activityId
                ? { ...activity, completed: !activity.completed }
                : activity
            ),
          }
        : plan
    );
  };

  // Render the planner home view
  const renderPlannerHome = () => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    const weekDates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return date;
    });
    const days = weekDates.map((date) =>
      date.toLocaleDateString("en-US", { weekday: "short" })
    );
    const dates = weekDates.map((date) => date.getDate());
    const todayIndex = weekOffset === 0 ? today.getDay() : -1;
    const times = ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM"];
    const blocks = [
      { day: 0, start: 1, span: 2, title: "Quadratic functions", meta: "Math 11 · Chapter 4", color: "bg-[#dcecff] border-[#91bdf5] text-[#164b87]", icon: Calculator },
      { day: 1, start: 4, span: 2, title: "Organic chemistry", meta: "Chemistry · Flashcards", color: "bg-[#ffe9d8] border-[#f4b27d] text-[#85451f]", icon: FlaskConical },
      { day: 2, start: 0, span: 3, title: "Essay outline", meta: "English · Draft notes", color: "bg-[#e8e2ff] border-[#b4a4ee] text-[#4c3c8c]", icon: BookOpen },
      { day: 2, start: 6, span: 2, title: "Practice quiz", meta: "Math 11 · 12 questions", color: "bg-[#dff5e8] border-[#8fd3aa] text-[#1f6741]", icon: Play },
      { day: 3, start: 2, span: 2, title: "Limits review", meta: "Calculus · Video + notes", color: "bg-[#dcecff] border-[#91bdf5] text-[#164b87]", icon: Calculator },
      { day: 4, start: 5, span: 2, title: "Weekly recap", meta: "Review · All subjects", color: "bg-[#ffe2eb] border-[#f2a1ba] text-[#8f294a]", icon: Sparkles },
      { day: 5, start: 1, span: 2, title: "Buffer / catch-up", meta: "Flexible study block", color: "bg-[#f1f3f5] border-[#cbd2d9] text-[#59636e]", icon: Clock3 }
    ];

    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-sm font-semibold text-[#73549a]"><Calendar className="h-4 w-4" /> Study planner</div><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#18231d]">Your week at a glance</h1><p className="mt-1 text-sm text-[#68766d]">Plan focused sessions, keep a little breathing room, and make progress visible.</p></div>
          <button onClick={handleCreatePlan} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#5b3a8c] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#472b70]"><PlusCircle className="h-4 w-4" /> {createdPlan ? "New study plan" : "Create study plan"}</button>
        </div>
        {createdPlan && (
          <div className="flex flex-col gap-4 rounded-lg border border-[#c9b6df] bg-[#f4effa] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#6941a5]" />
              <div>
                <h2 className="font-bold text-[#38234f]">{createdPlan.examName} plan created</h2>
                <p className="mt-1 text-sm text-[#665477]">
                  {createdPlan.subject} · {formatPlanDate(createdPlan.studyStartDate)} to {formatPlanDate(createdPlan.examDate)} · {createdPlan.dailyStudyMinutes} minutes daily
                </p>
                <p className="mt-1 text-xs text-[#8a7a98]">
                  {createdPlan.unavailableDays.length > 0
                    ? `Days off: ${createdPlan.unavailableDays.map(capitalize).join(", ")}`
                    : "No unavailable days selected"}
                </p>
              </div>
            </div>
            <span className="w-fit rounded-md border border-[#c9b6df] bg-white px-2.5 py-1 text-xs font-bold uppercase text-[#6941a5]">
              Draft
            </span>
          </div>
        )}
        {createdPlan && (
          <StudyPlanActivities
            plan={createdPlan}
            onAddActivity={handleAddActivity}
            onToggleActivity={handleToggleActivity}
          />
        )}
        <div className="flex flex-col gap-3 rounded-xl border border-[#dce5df] bg-white p-3 shadow-[0_8px_30px_rgba(45,67,53,0.06)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><button aria-label="Previous week" onClick={() => setWeekOffset((value) => value - 1)} className="rounded-md border border-[#dce5df] p-2 text-[#5d6d63] hover:bg-[#f3f7f4]"><ArrowLeft className="h-4 w-4" /></button><button onClick={() => setWeekOffset(0)} className="rounded-md border border-[#dce5df] px-3 py-2 text-sm font-semibold text-[#385445] hover:bg-[#f3f7f4]">Today</button><button aria-label="Next week" onClick={() => setWeekOffset((value) => value + 1)} className="rounded-md border border-[#dce5df] p-2 text-[#5d6d63] hover:bg-[#f3f7f4]"><ArrowRight className="h-4 w-4" /></button><span className="ml-2 text-sm font-semibold text-[#26372d]">{formatWeekRange(weekDates)}</span></div>
          <div className="flex items-center gap-2"><button className="inline-flex items-center gap-2 rounded-md border border-[#dce5df] px-3 py-2 text-sm font-medium text-[#526259]"><SlidersHorizontal className="h-4 w-4" /> Filters</button><button className="inline-flex items-center gap-1 rounded-md border border-[#dce5df] px-3 py-2 text-sm font-medium text-[#526259]">Week <ChevronDown className="h-4 w-4" /></button></div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#dce5df] bg-white shadow-[0_8px_30px_rgba(45,67,53,0.06)]"><div className="min-w-[840px]"><div className="grid grid-cols-[64px_repeat(7,minmax(108px,1fr))] border-b border-[#e7ece8] bg-[#fbfcfb]"><div className="border-r border-[#e7ece8]" />{days.map((day, index) => <div key={day} className={`border-r border-[#e7ece8] px-2 py-3 text-center last:border-r-0 ${index === todayIndex ? "bg-[#f3edfa]" : ""}`}><p className="text-[11px] font-bold uppercase tracking-wider text-[#839088]">{day}</p><p className={`mt-1 text-lg font-bold ${index === todayIndex ? "text-[#7046a8]" : "text-[#26372d]"}`}>{dates[index]}</p></div>)}</div><div className="grid grid-cols-[64px_repeat(7,minmax(108px,1fr))]"><div className="bg-[#f3edfa]">{times.map((time) => <div key={time} className="h-16 border-b border-r border-[#e4dced] pr-2 pt-1 text-right text-[10px] font-medium text-[#806c91]">{time}</div>)}</div>{days.map((day, dayIndex) => <div key={day} className={`relative border-r border-[#edf0ee] last:border-r-0 ${dayIndex === todayIndex ? "bg-[#fdfbff]" : ""}`}>{times.map((time) => <div key={`${day}-${time}`} className="h-16 border-b border-[#edf0ee]" />)}{blocks.filter((block) => block.day === dayIndex).map((block) => { const Icon = block.icon; return <div key={block.title} className={`absolute left-1.5 right-1.5 rounded-md border p-2 shadow-sm ${block.color}`} style={{ top: `${block.start * 64 + 4}px`, height: `${block.span * 64 - 8}px` }}><div className="flex items-start justify-between gap-1"><Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" /><MoreHorizontal className="h-3.5 w-3.5 opacity-60" /></div><p className="mt-1 truncate text-xs font-bold">{block.title}</p><p className="mt-0.5 truncate text-[10px] font-medium opacity-75">{block.meta}</p></div>; })}</div>)}</div></div></div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"><div className="rounded-xl border border-[#dce5df] bg-[#f7f1fb] p-4"><div className="flex items-start gap-3"><div className="rounded-lg bg-[#eadcf5] p-2 text-[#6941a5]"><Sparkles className="h-5 w-5" /></div><div><h2 className="font-bold text-[#38234f]">A steady week beats a packed week</h2><p className="mt-1 text-sm leading-6 text-[#75627f]">You have 7 hours planned across 5 subjects. There is still room for one catch-up session.</p></div></div></div><div className="rounded-xl border border-[#dce5df] bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-bold text-[#26372d]">This week</h2><MoreHorizontal className="h-5 w-5 text-[#73549a]" /></div><div className="mt-3 flex items-center justify-between text-sm"><span className="text-[#718077]">Completed</span><span className="font-bold text-[#5b3a8c]">2 of 8 sessions</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eee6f5]"><div className="h-full w-1/4 rounded-full bg-[#9a6aca]" /></div></div></div>
      </div>
    );
  };

  // Main render method
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {showPlanner ? (
        renderPlannerHome()
      ) : showCreate ? (
        <StudyPlanWizard
            onBack={handleBack}
            onPlanCreated={handlePlanCreated}
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

const formatPlanDate = (value) => {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatWeekRange = (dates) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(dates[0])} - ${formatter.format(dates[6])}`;
};

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export default StudyPlans;
