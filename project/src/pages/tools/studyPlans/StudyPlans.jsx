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
  Clock3,
  FlaskConical,
  MoreHorizontal,
  Play,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import { getStudyPlan } from "../../../api/apiService";
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

  // Render the planner home view
  const renderPlannerHome = () => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dates = ["6", "7", "8", "9", "10", "11", "12"];
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
          <div><div className="flex items-center gap-2 text-sm font-semibold text-[#52705f]"><Calendar className="h-4 w-4" /> Study planner</div><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#18231d]">Your week at a glance</h1><p className="mt-1 text-sm text-[#68766d]">Plan focused sessions, keep a little breathing room, and make progress visible.</p></div>
          <button onClick={handleCreatePlan} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#274c3a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d3c2d]"><PlusCircle className="h-4 w-4" /> New study block</button>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-[#dce5df] bg-white p-3 shadow-[0_8px_30px_rgba(45,67,53,0.06)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><button aria-label="Previous week" onClick={() => setWeekOffset((value) => value - 1)} className="rounded-md border border-[#dce5df] p-2 text-[#5d6d63] hover:bg-[#f3f7f4]"><ArrowLeft className="h-4 w-4" /></button><button onClick={() => setWeekOffset(0)} className="rounded-md border border-[#dce5df] px-3 py-2 text-sm font-semibold text-[#385445] hover:bg-[#f3f7f4]">Today</button><button aria-label="Next week" onClick={() => setWeekOffset((value) => value + 1)} className="rounded-md border border-[#dce5df] p-2 text-[#5d6d63] hover:bg-[#f3f7f4]"><ArrowRight className="h-4 w-4" /></button><span className="ml-2 text-sm font-semibold text-[#26372d]">Apr {6 + weekOffset * 7} – Apr {12 + weekOffset * 7}, 2026</span></div>
          <div className="flex items-center gap-2"><button className="inline-flex items-center gap-2 rounded-md border border-[#dce5df] px-3 py-2 text-sm font-medium text-[#526259]"><SlidersHorizontal className="h-4 w-4" /> Filters</button><button className="inline-flex items-center gap-1 rounded-md border border-[#dce5df] px-3 py-2 text-sm font-medium text-[#526259]">Week <ChevronDown className="h-4 w-4" /></button></div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#dce5df] bg-white shadow-[0_8px_30px_rgba(45,67,53,0.06)]"><div className="min-w-[840px]"><div className="grid grid-cols-[64px_repeat(7,minmax(108px,1fr))] border-b border-[#e7ece8] bg-[#fbfcfb]"><div className="border-r border-[#e7ece8]" />{days.map((day, index) => <div key={day} className={`border-r border-[#e7ece8] px-2 py-3 text-center last:border-r-0 ${index === 2 ? "bg-[#edf7f0]" : ""}`}><p className="text-[11px] font-bold uppercase tracking-wider text-[#839088]">{day}</p><p className={`mt-1 text-lg font-bold ${index === 2 ? "text-[#27704a]" : "text-[#26372d]"}`}>{dates[index]}</p></div>)}</div><div className="grid grid-cols-[64px_repeat(7,minmax(108px,1fr))]"><div className="bg-[#fbfcfb]">{times.map((time) => <div key={time} className="h-16 border-b border-r border-[#edf0ee] pr-2 pt-1 text-right text-[10px] font-medium text-[#9aa59e]">{time}</div>)}</div>{days.map((day, dayIndex) => <div key={day} className={`relative border-r border-[#edf0ee] last:border-r-0 ${dayIndex === 2 ? "bg-[#fcfefc]" : ""}`}>{times.map((time) => <div key={`${day}-${time}`} className="h-16 border-b border-[#edf0ee]" />)}{blocks.filter((block) => block.day === dayIndex).map((block) => { const Icon = block.icon; return <div key={block.title} className={`absolute left-1.5 right-1.5 rounded-md border p-2 shadow-sm ${block.color}`} style={{ top: `${block.start * 64 + 4}px`, height: `${block.span * 64 - 8}px` }}><div className="flex items-start justify-between gap-1"><Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" /><MoreHorizontal className="h-3.5 w-3.5 opacity-60" /></div><p className="mt-1 truncate text-xs font-bold">{block.title}</p><p className="mt-0.5 truncate text-[10px] font-medium opacity-75">{block.meta}</p></div>; })}</div>)}</div></div></div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"><div className="rounded-xl border border-[#dce5df] bg-[#f1f8f3] p-4"><div className="flex items-start gap-3"><div className="rounded-lg bg-[#d7eddd] p-2 text-[#287247]"><Sparkles className="h-5 w-5" /></div><div><h2 className="font-bold text-[#234432]">A steady week beats a packed week</h2><p className="mt-1 text-sm leading-6 text-[#5e7465]">You have 7 hours planned across 5 subjects. There is still room for one catch-up session.</p></div></div></div><div className="rounded-xl border border-[#dce5df] bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-bold text-[#26372d]">This week</h2><MoreHorizontal className="h-5 w-5 text-[#52705f]" /></div><div className="mt-3 flex items-center justify-between text-sm"><span className="text-[#718077]">Completed</span><span className="font-bold text-[#274c3a]">2 of 8 sessions</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e5eee7]"><div className="h-full w-1/4 rounded-full bg-[#66a87c]" /></div></div></div>
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
          onPlanCreated={(plan) => {
            setCurrentPlan(plan);
            setShowCreate(false);
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
