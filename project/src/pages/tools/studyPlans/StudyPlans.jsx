import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  PlusCircle,
  Calendar,
  ChevronDown,
  CheckCircle2,
  MoreHorizontal,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import {
  addStudyPlanMaterial,
  addStudyPlanActivity,
  getStudyPlan,
  removeStudyPlanMaterial,
  saveStudyPlan,
  updateStudyPlanActivity,
} from "../../../api/apiService";
import StudyPlanActivities from "./StudyPlanActivities";
import StudyPlanMaterials from "./StudyPlanMaterials";
import StudyPlanWizard from "./StudyPlanWizard";
import StudyPlanDisplay from "./StudyPlanDisplay";

/**
 * Main StudyPlans component that coordinates all other components
 */
const StudyPlans = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const planId = searchParams.get("planId");

  // State for component display
  const [showCreate, setShowCreate] = useState(false);
  const [showPlanner, setShowPlanner] = useState(true);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [createdPlan, setCreatedPlan] = useState(null);
  const [planStatus, setPlanStatus] = useState("idle"); // idle, loading, ready, updating
  const [planError, setPlanError] = useState("");
  const [activitySaving, setActivitySaving] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [materialSaving, setMaterialSaving] = useState(false);
  const [materialError, setMaterialError] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (!planId) {
      return;
    }

    let cancelled = false;

    const loadPlanFromQuery = async () => {
      try {
        setPlanStatus("loading");
        setPlanError("");
        setMaterialError("");
        const plan = await getStudyPlan(planId);
        if (cancelled) {
          return;
        }

        if (plan?.data?.examName) {
          setCreatedPlan(normalizeStructuredPlan(plan));
          setCurrentPlan(null);
          setShowPlanner(true);
        } else {
          setCurrentPlan(plan);
          setCreatedPlan(null);
          setShowPlanner(false);
        }
        setShowCreate(false);
        setPlanStatus("ready");
      } catch (err) {
        console.error("Error fetching study plan by id:", err);
        if (!cancelled) {
          setPlanError("We couldn't load this study plan. Please try again.");
          setPlanStatus("idle");
        }
      }
    };

    loadPlanFromQuery();

    return () => {
      cancelled = true;
    };
  }, [planId]);

  // Create a new study plan
  const handleCreatePlan = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("planId");
    setSearchParams(nextParams, { replace: true });
    setShowPlanner(false);
    setShowCreate(true);
    setCurrentPlan(null);
    setCreatedPlan(null);
    setPlanError("");
    setActivityError("");
    setMaterialError("");
    setPlanStatus("idle");
  };

  // Go back to the planner view
  const handleBack = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("planId");
    setSearchParams(nextParams, { replace: true });
    setShowPlanner(true);
    setShowCreate(false);
    setCurrentPlan(null);
    setPlanError("");
    setMaterialError("");
  };

  const handlePlanCreated = async (plan) => {
    try {
      setPlanStatus("loading");
      setPlanError("");

      const response = await saveStudyPlan(plan);
      const savedPlan = {
        ...response.plan,
        activities: response.plan.activities || [],
        materials: response.plan.materials || [],
      };

      setCreatedPlan(savedPlan);
      setSearchParams({ planId: savedPlan.id }, { replace: true });
      setShowPlanner(true);
      setShowCreate(false);
      setPlanStatus("ready");
    } catch (error) {
      console.error("Failed to save study plan:", error);
      setPlanError(error.message || "Failed to save the study plan.");
      setPlanStatus("idle");
      throw error;
    }
  };

  const handleAddActivity = async (activity) => {
    if (!createdPlan?.id) {
      throw new Error("Save the study plan before adding activities.");
    }

    try {
      setActivitySaving(true);
      setActivityError("");
      const response = await addStudyPlanActivity(createdPlan.id, activity);
      setCreatedPlan(response.plan);
    } catch (error) {
      console.error("Failed to save study activity:", error);
      setActivityError(error.message || "Failed to save the study activity.");
      throw error;
    } finally {
      setActivitySaving(false);
    }
  };

  const handleToggleActivity = async (activityId) => {
    const activity = (createdPlan?.activities || []).find(
      (item) => item.id === activityId
    );
    if (!createdPlan?.id || !activity) {
      return;
    }

    try {
      setActivitySaving(true);
      setActivityError("");
      const response = await updateStudyPlanActivity(
        createdPlan.id,
        activityId,
        !activity.completed
      );
      setCreatedPlan(response.plan);
    } catch (error) {
      console.error("Failed to update study activity:", error);
      setActivityError(error.message || "Failed to update the study activity.");
    } finally {
      setActivitySaving(false);
    }
  };

  const handleAddMaterials = async (files) => {
    if (!createdPlan?.id || files.length === 0) {
      return;
    }

    try {
      setMaterialSaving(true);
      setMaterialError("");
      for (const file of files) {
        const response = await addStudyPlanMaterial(createdPlan.id, file);
        setCreatedPlan(response.plan);
      }
    } catch (error) {
      console.error("Failed to save study material:", error);
      setMaterialError(error.message || "Failed to save the study material.");
    } finally {
      setMaterialSaving(false);
    }
  };

  const handleRemoveMaterial = async (materialId) => {
    if (!createdPlan?.id) {
      return;
    }

    try {
      setMaterialSaving(true);
      setMaterialError("");
      const response = await removeStudyPlanMaterial(
        createdPlan.id,
        materialId
      );
      setCreatedPlan(response.plan);
    } catch (error) {
      console.error("Failed to remove study material:", error);
      setMaterialError(error.message || "Failed to remove the study material.");
    } finally {
      setMaterialSaving(false);
    }
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
    const blocks = [];

    return (
      <div className="space-y-5">
        {planStatus === "loading" && (
          <p role="status" className="rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-medium text-primary-800">
            Loading your saved study plan...
          </p>
        )}
        {planError && (
          <p role="alert" className="rounded-md border border-[#e6b8b8] bg-[#fff3f3] px-4 py-3 text-sm font-medium text-[#9b3434]">
            {planError}
          </p>
        )}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-sm font-semibold text-blue-700"><Calendar className="h-4 w-4" /> Study planner</div><h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Your week at a glance</h1><p className="mt-1 text-sm text-gray-600">Plan focused sessions, keep a little breathing room, and make progress visible.</p></div>
          <button onClick={handleCreatePlan} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"><PlusCircle className="h-4 w-4" /> {createdPlan ? "New study plan" : "Create study plan"}</button>
        </div>
        {createdPlan && (
          <div className="flex flex-col gap-4 rounded-lg border border-primary-200 bg-primary-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <h2 className="font-bold text-blue-950">{createdPlan.examName} plan created</h2>
                <p className="mt-1 text-sm text-blue-900">
                  {createdPlan.subject} · {formatPlanDate(createdPlan.studyStartDate)} to {formatPlanDate(createdPlan.examDate)} · {createdPlan.dailyStudyMinutes} minutes daily
                </p>
                <p className="mt-1 text-xs text-blue-800">
                  {createdPlan.unavailableDays.length > 0
                    ? `Days off: ${createdPlan.unavailableDays.map(capitalize).join(", ")}`
                    : "No unavailable days selected"}
                </p>
              </div>
            </div>
            <span className="w-fit rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold uppercase text-blue-700">
              Draft
            </span>
          </div>
        )}
        {createdPlan && (
          <StudyPlanMaterials
            materials={createdPlan.materials || []}
            onAddMaterials={handleAddMaterials}
            onRemoveMaterial={handleRemoveMaterial}
            isSaving={materialSaving}
            error={materialError}
          />
        )}
        {createdPlan && (
          <StudyPlanActivities
            plan={createdPlan}
            onAddActivity={handleAddActivity}
            onToggleActivity={handleToggleActivity}
            isSaving={activitySaving}
            error={activityError}
          />
        )}
        <div className="flex flex-col gap-3 rounded-xl border border-primary-700 bg-primary-600 p-3 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><button aria-label="Previous week" onClick={() => setWeekOffset((value) => value - 1)} className="rounded-md border border-white/30 p-2 text-white hover:bg-white/10"><ArrowLeft className="h-4 w-4" /></button><button onClick={() => setWeekOffset(0)} className="rounded-md border border-white bg-white px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-primary-50">Today</button><button aria-label="Next week" onClick={() => setWeekOffset((value) => value + 1)} className="rounded-md border border-white/30 p-2 text-white hover:bg-white/10"><ArrowRight className="h-4 w-4" /></button><span className="ml-2 text-sm font-semibold text-white">{formatWeekRange(weekDates)}</span></div>
          <div className="flex items-center gap-2"><button className="inline-flex items-center gap-2 rounded-md border border-white/30 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"><SlidersHorizontal className="h-4 w-4" /> Filters</button><button className="inline-flex items-center gap-1 rounded-md border border-white/30 px-3 py-2 text-sm font-medium text-white hover:bg-white/10">Week <ChevronDown className="h-4 w-4" /></button></div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm"><div className="min-w-[840px]"><div className="grid grid-cols-[64px_repeat(7,minmax(108px,1fr))] border-b border-gray-200 bg-gray-50"><div className="border-r border-gray-200" />{days.map((day, index) => <div key={day} className={`border-r border-gray-200 px-2 py-3 text-center last:border-r-0 ${index === todayIndex ? "bg-primary-50" : ""}`}><p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">{day}</p><p className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold ${index === todayIndex ? "bg-primary-100 text-primary-800" : "text-gray-900"}`}>{dates[index]}</p></div>)}</div><div className="grid grid-cols-[64px_repeat(7,minmax(108px,1fr))]"><div className="bg-primary-50">{times.map((time) => <div key={time} className="h-16 border-b border-r border-primary-100 pr-2 pt-1 text-right text-[10px] font-medium text-primary-700">{time}</div>)}</div>{days.map((day, dayIndex) => <div key={day} className={`relative border-r border-gray-100 last:border-r-0 ${dayIndex === todayIndex ? "bg-primary-50/40" : ""}`}>{times.map((time) => <div key={`${day}-${time}`} className="h-16 border-b border-gray-100" />)}{blocks.filter((block) => block.day === dayIndex).map((block) => { const Icon = block.icon; return <div key={block.title} className={`absolute left-1.5 right-1.5 rounded-md border p-2 shadow-sm ${block.color}`} style={{ top: `${block.start * 64 + 4}px`, height: `${block.span * 64 - 8}px` }}><div className="flex items-start justify-between gap-1"><Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" /><MoreHorizontal className="h-3.5 w-3.5 opacity-60" /></div><p className="mt-1 truncate text-xs font-bold">{block.title}</p><p className="mt-0.5 truncate text-[10px] font-medium opacity-75">{block.meta}</p></div>; })}</div>)}</div></div></div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"><div className="rounded-xl border border-primary-200 bg-primary-50 p-4"><div className="flex items-start gap-3"><div className="rounded-lg bg-primary-100 p-2 text-primary-700"><Sparkles className="h-5 w-5" /></div><div><h2 className="font-bold text-primary-900">A steady week beats a packed week</h2><p className="mt-1 text-sm leading-6 text-primary-900">You have 7 hours planned across 5 subjects. There is still room for one catch-up session.</p></div></div></div><div className="rounded-xl border border-gray-200 bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-bold text-gray-800">This week</h2><MoreHorizontal className="h-5 w-5 text-primary-700" /></div><div className="mt-3 flex items-center justify-between text-sm"><span className="text-gray-500">Completed</span><span className="font-bold text-primary-700">2 of 8 sessions</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-100"><div className="h-full w-1/4 rounded-full bg-primary-600" /></div></div></div>
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
          isSaving={planStatus === "loading"}
          saveError={planError}
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

const normalizeStructuredPlan = (studyPlanDocument) => ({
  id: studyPlanDocument.id,
  ...studyPlanDocument.data,
  activities: studyPlanDocument.data?.activities || [],
  materials: studyPlanDocument.data?.materials || [],
});

export default StudyPlans;
