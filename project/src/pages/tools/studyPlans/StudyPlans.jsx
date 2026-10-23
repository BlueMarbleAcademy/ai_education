import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  PlusCircle,
  Calendar,
  ChevronDown,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import {
  addStudyPlanMaterial,
  addStudyPlanActivity,
  confirmStudyPlanTopics,
  getStudyPlan,
  getStudyPlans,
  analyzeStudyPlanTopics,
  saveStudyPlanTopicReview,
  removeStudyPlanMaterial,
  saveStudyPlan,
  updateStudyPlanActivity,
} from "../../../api/apiService";
import StudyPlanActivities from "./StudyPlanActivities";
import StudyPlanMaterials from "./StudyPlanMaterials";
import StudyPlanWizard from "./StudyPlanWizard";
import StudyPlanDisplay from "./StudyPlanDisplay";
import StudyPlanSelector from "./StudyPlanSelector";
import { getAvailableStudyDays } from "./studyPlanDates";
import {
  buildCalendarBlocks,
  formatPlannedTime,
  getPlanFocusDate,
  getWeekActivities,
  getWeekOffsetForDate,
} from "./studyPlanCalendar";

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
  const [expandedTopics, setExpandedTopics] = useState({});
  const [reviewingTopics, setReviewingTopics] = useState(false);
  const [incorrectTopics, setIncorrectTopics] = useState({});
  const [missingTopicInput, setMissingTopicInput] = useState("");
  const [missingTopics, setMissingTopics] = useState([]);
  const [selectedTopicNames, setSelectedTopicNames] = useState([]);
  const [topicConfirmationStatus, setTopicConfirmationStatus] = useState("idle");
  const [topicConfirmationMessage, setTopicConfirmationMessage] = useState("");
  const [topicAnalysisStatus, setTopicAnalysisStatus] = useState("idle");
  const [topicAnalysisMessage, setTopicAnalysisMessage] = useState("");
  const [planStatus, setPlanStatus] = useState("idle"); // idle, loading, ready, updating
  const [planError, setPlanError] = useState("");
  const [activitySaving, setActivitySaving] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [materialSaving, setMaterialSaving] = useState(false);
  const [materialError, setMaterialError] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [savedPlans, setSavedPlans] = useState([]);
  const [plansStatus, setPlansStatus] = useState("loading");
  const [plansError, setPlansError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadSavedPlans = async () => {
      try {
        setPlansStatus("loading");
        setPlansError("");
        const plans = await getStudyPlans();
        if (!cancelled) {
          setSavedPlans(plans || []);
          setPlansStatus("ready");
        }
      } catch (error) {
        console.error("Failed to load saved study plans:", error);
        if (!cancelled) {
          setPlansError("We couldn't load your saved study plans. Please try again.");
          setPlansStatus("error");
        }
      }
    };

    loadSavedPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      showCreate ||
      planId ||
      plansStatus !== "ready" ||
      savedPlans.length === 0
    ) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("planId", savedPlans[0].id);
    setSearchParams(nextParams, { replace: true });
  }, [
    planId,
    plansStatus,
    savedPlans,
    searchParams,
    setSearchParams,
    showCreate,
  ]);

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
          const structuredPlan = normalizeStructuredPlan(plan);
          const topicCount = structuredPlan.identifiedTopics?.length || 0;
          const selectedTopics = getInitialSelectedTopicNames(structuredPlan);
          const topicsAreConfirmed =
            structuredPlan.topicConfirmation?.status === "confirmed";
          setCreatedPlan(structuredPlan);
          setSelectedTopicNames(selectedTopics);
          setTopicConfirmationStatus(
            topicsAreConfirmed ? "success" : "idle"
          );
          setTopicConfirmationMessage(
            topicsAreConfirmed
              ? `${selectedTopics.length} topic${selectedTopics.length === 1 ? "" : "s"} confirmed for this study plan.`
              : ""
          );
          setTopicAnalysisStatus(topicCount > 0 ? "success" : "idle");
          setTopicAnalysisMessage(
            topicCount > 0
              ? `Analysis complete. Found ${topicCount} topic${topicCount === 1 ? "" : "s"}.`
              : ""
          );
          setWeekOffset(getWeekOffsetForDate(getPlanFocusDate(structuredPlan)));
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

  const handleSelectPlan = (selectedPlanId) => {
    if (!selectedPlanId || selectedPlanId === planId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("planId", selectedPlanId);
    setCreatedPlan(null);
    setCurrentPlan(null);
    setShowCreate(false);
    setShowPlanner(true);
    setPlanError("");
    setActivityError("");
    setMaterialError("");
    setSelectedTopicNames([]);
    setTopicConfirmationStatus("idle");
    setTopicConfirmationMessage("");
    setTopicAnalysisStatus("idle");
    setTopicAnalysisMessage("");
    setWeekOffset(0);
    setSearchParams(nextParams);
  };

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
    setSelectedTopicNames([]);
    setTopicConfirmationStatus("idle");
    setTopicConfirmationMessage("");
    setTopicAnalysisStatus("idle");
    setTopicAnalysisMessage("");
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
      setSelectedTopicNames([]);
      setTopicConfirmationStatus("idle");
      setTopicConfirmationMessage("");
      setTopicAnalysisStatus("idle");
      setTopicAnalysisMessage("");
      setWeekOffset(getWeekOffsetForDate(getPlanFocusDate(savedPlan)));
      setSavedPlans((plans) => [
        toStudyPlanSummary(savedPlan),
        ...plans.filter((item) => item.id !== savedPlan.id),
      ]);
      setPlansStatus("ready");
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

  const handleAnalyzeTopics = async () => {
    if (!createdPlan?.id) {
      setTopicAnalysisStatus("error");
      setTopicAnalysisMessage("Select or save a study plan before analyzing materials.");
      return;
    }

    const planMaterials = createdPlan.materials || [];
    if (planMaterials.length === 0) {
      setTopicAnalysisStatus("error");
      setTopicAnalysisMessage("Add at least one study material before analyzing topics.");
      return;
    }

    const allMaterialsReady = planMaterials.every(
      (material) => (material.status || "ready").toLowerCase() === "ready"
    );
    if (!allMaterialsReady) {
      setTopicAnalysisStatus("error");
      setTopicAnalysisMessage("Wait for all study materials to finish processing.");
      return;
    }

    try {
      setTopicAnalysisStatus("analyzing");
      setTopicAnalysisMessage(
        `Analyzing ${planMaterials.length} study material${planMaterials.length === 1 ? "" : "s"}...`
      );
      const result = await analyzeStudyPlanTopics(createdPlan.id);
      const topics = result.topics || [];

      setCreatedPlan((plan) =>
        plan
          ? {
              ...plan,
              identifiedTopics: topics,
              confirmedTopics: [],
              topicConfirmation: {
                status: "not_confirmed",
                confirmedAt: null,
                topicNames: [],
              },
              topicAnalysis: result.analysis,
            }
          : plan
      );
      setSelectedTopicNames(topics.map((topic) => topic.name));
      setTopicConfirmationStatus("idle");
      setTopicConfirmationMessage("Select the topics to include, then confirm them.");
      setTopicAnalysisStatus("success");
      setTopicAnalysisMessage(
        `Analysis complete. Found ${topics.length} topic${topics.length === 1 ? "" : "s"}.`
      );
    } catch (error) {
      console.error("Failed to analyze study plan topics:", error);
      setTopicAnalysisStatus("error");
      setTopicAnalysisMessage(
        error.message || "The study materials could not be analyzed. Please try again."
      );
    }
  };

  const handleFinishTopicReview = async () => {
    if (!createdPlan?.id) return;

    const incorrectTopicNames = createdPlan.identifiedTopics
      .filter((_, topicIndex) => incorrectTopics[topicIndex])
      .map((topic) => topic.name);

    try {
      const result = await saveStudyPlanTopicReview(
        createdPlan.id,
        incorrectTopicNames,
        missingTopics
      );

      setCreatedPlan((plan) =>
        plan
          ? {
              ...plan,
              topicReview: result.topicReview,
            }
          : plan
      );

      setReviewingTopics(false);

      console.log("Topic review saved:", result);
    } catch (error) {
      console.error("Failed to save topic review:", error);
    }
  };

  const handleToggleTopicSelection = (topicName) => {
    setSelectedTopicNames((current) =>
      current.includes(topicName)
        ? current.filter((name) => name !== topicName)
        : [...current, topicName]
    );
    setTopicConfirmationStatus("idle");
    setTopicConfirmationMessage("Confirm your choices to save them.");
  };

  const handleConfirmTopics = async () => {
    if (!createdPlan?.id) {
      return;
    }
    if (selectedTopicNames.length === 0) {
      setTopicConfirmationStatus("error");
      setTopicConfirmationMessage(
        "Select at least one topic to include in the study plan."
      );
      return;
    }

    try {
      setTopicConfirmationStatus("saving");
      setTopicConfirmationMessage("Saving your topic choices...");
      const result = await confirmStudyPlanTopics(
        createdPlan.id,
        selectedTopicNames
      );
      const confirmedTopics = result.confirmedTopics || [];

      setCreatedPlan((plan) =>
        plan
          ? {
              ...plan,
              confirmedTopics,
              topicConfirmation: result.confirmation,
            }
          : plan
      );
      setSelectedTopicNames(
        confirmedTopics.map((topic) => topic.name)
      );
      setTopicConfirmationStatus("success");
      const scheduledDayCount = new Set(
        confirmedTopics
          .map((topic) => topic.scheduledDate)
          .filter(Boolean)
      ).size;
      setTopicConfirmationMessage(
        scheduledDayCount > 0
          ? `All ${confirmedTopics.length} selected topic${confirmedTopics.length === 1 ? "" : "s"} scheduled before the exam across ${scheduledDayCount} remaining study day${scheduledDayCount === 1 ? "" : "s"}.`
          : `${confirmedTopics.length} topic${confirmedTopics.length === 1 ? "" : "s"} confirmed, but no study days remain before the exam.`
      );
    } catch (error) {
      console.error("Failed to confirm study plan topics:", error);
      setTopicConfirmationStatus("error");
      setTopicConfirmationMessage(
        error.message || "The selected topics could not be saved."
      );
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
      setSavedPlans((plans) =>
        plans.map((plan) =>
          plan.id === response.plan.id
            ? toStudyPlanSummary(response.plan, plan)
            : plan
        )
      );
      setWeekOffset(getWeekOffsetForDate(activity.studyDate));
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
      setSavedPlans((plans) =>
        plans.map((plan) =>
          plan.id === response.plan.id
            ? toStudyPlanSummary(response.plan, plan)
            : plan
        )
      );
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
      setSelectedTopicNames([]);
      setTopicConfirmationStatus("idle");
      setTopicConfirmationMessage("");
      setTopicAnalysisStatus("idle");
      setTopicAnalysisMessage("Materials updated. Analyze them to identify study topics.");
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
      setSelectedTopicNames([]);
      setTopicConfirmationStatus("idle");
      setTopicConfirmationMessage("");
      setTopicAnalysisStatus("idle");
      setTopicAnalysisMessage(
        response.plan.materials?.length
          ? "Materials updated. Analyze them again to refresh the study topics."
          : ""
      );
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
    const activities = createdPlan?.activities || [];
    const studyMaterials = createdPlan?.materials || [];
    const availableStudyDayCount = createdPlan
      ? getAvailableStudyDays(
          createdPlan.studyStartDate,
          createdPlan.examDate,
          createdPlan.unavailableDays
        ).length
      : 0;
    const allMaterialsReady =
      studyMaterials.length > 0 &&
      studyMaterials.every(
        (material) => (material.status || "ready").toLowerCase() === "ready"
      );
    const isAnalyzingTopics = topicAnalysisStatus === "analyzing";
    const isConfirmingTopics = topicConfirmationStatus === "saving";
    const weekActivities = getWeekActivities(activities, weekDates);
    const completedWeekActivities = weekActivities.filter(
      (activity) => activity.completed
    ).length;
    const plannedWeekMinutes = weekActivities.reduce(
      (total, activity) => total + Number(activity.estimatedMinutes || 0),
      0
    );
    const completionPercentage = weekActivities.length
      ? Math.round((completedWeekActivities / weekActivities.length) * 100)
      : 0;
    const blocks = buildCalendarBlocks(activities, weekDates);

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
        <div className="flex flex-col gap-3 rounded-xl border border-primary-700 bg-primary-600 p-3 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              aria-label="Previous week"
              onClick={() => setWeekOffset((value) => value - 1)}
              className="rounded-md border border-white/30 p-2 text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-md border border-white bg-white px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-primary-50"
            >
              Today
            </button>
            <button
              aria-label="Next week"
              onClick={() => setWeekOffset((value) => value + 1)}
              className="rounded-md border border-white/30 p-2 text-white hover:bg-white/10"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            <span className="ml-2 text-sm font-semibold text-white">
              {formatWeekRange(weekDates)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-md border border-white/30 px-3 py-2 text-sm font-medium text-white hover:bg-white/10">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </button>
            <button className="inline-flex items-center gap-1 rounded-md border border-white/30 px-3 py-2 text-sm font-medium text-white hover:bg-white/10">
              Week <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="min-w-[840px]">
            <div className="grid grid-cols-[64px_repeat(7,minmax(108px,1fr))] border-b border-gray-200 bg-gray-50">
              <div className="border-r border-gray-200" />
              {days.map((day, index) => (
                <div
                  key={day}
                  className={`border-r border-gray-200 px-2 py-3 text-center last:border-r-0 ${
                    index === todayIndex ? "bg-primary-50" : ""
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    {day}
                  </p>
                  <p
                    className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold ${
                      index === todayIndex
                        ? "bg-primary-100 text-primary-800"
                        : "text-gray-900"
                    }`}
                  >
                    {dates[index]}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[64px_repeat(7,minmax(108px,1fr))]">
              <div className="bg-primary-50">
                {times.map((time) => (
                  <div
                    key={time}
                    className="h-16 border-b border-r border-primary-100 pr-2 pt-1 text-right text-[10px] font-medium text-primary-700"
                  >
                    {time}
                  </div>
                ))}
              </div>
              {days.map((day, dayIndex) => (
                <div
                  key={day}
                  className={`relative border-r border-gray-100 last:border-r-0 ${
                    dayIndex === todayIndex ? "bg-primary-50/40" : ""
                  }`}
                >
                  {times.map((time) => (
                    <div
                      key={`${day}-${time}`}
                      className="h-16 border-b border-gray-100"
                    />
                  ))}
                  {blocks
                    .filter((block) => block.day === dayIndex)
                    .map((block) => (
                      <article
                        key={block.id}
                        aria-label={`${block.title}, ${block.meta}${
                          block.completed ? ", completed" : ""
                        }`}
                        className={`absolute left-1.5 right-1.5 overflow-hidden rounded-md border p-1.5 shadow-sm ${
                          block.color
                        } ${block.completed ? "opacity-65" : ""}`}
                        style={{
                          top: `${block.start * 64 + 4}px`,
                          height: `${block.span * 64 - 8}px`,
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <p
                            className={`min-w-0 flex-1 truncate text-xs font-bold ${
                              block.completed ? "line-through" : ""
                            }`}
                          >
                            {block.title}
                          </p>
                          {block.completed && (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          )}
                        </div>
                        <p className="mt-1 truncate pl-[18px] text-[10px] font-medium leading-none opacity-75">
                          {block.meta}
                        </p>
                      </article>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary-100 p-2 text-primary-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-primary-900">
                  A steady week beats a packed week
                </h2>
                <p className="mt-1 text-sm leading-6 text-primary-900">
                  {weekActivities.length > 0
                    ? `You have ${formatPlannedTime(
                        plannedWeekMinutes
                      )} planned across ${weekActivities.length} study session${
                        weekActivities.length === 1 ? "" : "s"
                      } this week.`
                    : createdPlan
                      ? "No study sessions are planned for this week yet."
                      : "Create a plan and add activities to start filling your calendar."}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">This week</h2>
              <MoreHorizontal className="h-5 w-5 text-primary-700" />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-gray-500">Completed</span>
              <span className="font-bold text-primary-700">
                {completedWeekActivities} of {weekActivities.length} sessions
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-100">
              <div
                className="h-full rounded-full bg-primary-600 transition-[width]"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
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
                  {availableStudyDayCount} available study{" "}
                  {availableStudyDayCount === 1 ? "day" : "days"}
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
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleAnalyzeTopics}
              disabled={!allMaterialsReady || materialSaving || isAnalyzingTopics}
              className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzingTopics ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isAnalyzingTopics
                ? "Analyzing..."
                : createdPlan.identifiedTopics?.length
                  ? "Analyze again"
                  : "Analyze topics"}
            </button>

            {studyMaterials.length === 0 && (
              <p className="text-sm text-[#718077]">
                Add study materials before analyzing topics.
              </p>
            )}

            {topicAnalysisMessage && (
              <p
                role={topicAnalysisStatus === "error" ? "alert" : "status"}
                aria-live="polite"
                className={`flex items-center gap-2 text-sm font-medium ${
                  topicAnalysisStatus === "error"
                    ? "text-[#9b3434]"
                    : topicAnalysisStatus === "success"
                      ? "text-[#2f6b46]"
                      : "text-[#607067]"
                }`}
              >
                {topicAnalysisStatus === "error" && (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                {topicAnalysisStatus === "success" && (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                )}
                {topicAnalysisMessage}
              </p>
            )}
          </div>
        )}

        {createdPlan?.identifiedTopics?.length > 0 && (
          <div className="rounded-lg border border-[#dce5df] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#26372d]">
                  Identified Topics
                </h2>
                <p className="mt-1 text-sm text-[#607067]">
                  Choose the topics to include in your study plan.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (reviewingTopics) {
                    handleFinishTopicReview();
                  } else {
                    const savedIncorrectTopics =
                      createdPlan.topicReview?.incorrectTopics || [];

                    const restoredIncorrectTopics = {};

                    createdPlan.identifiedTopics.forEach((topic, topicIndex) => {
                      if (savedIncorrectTopics.includes(topic.name)) {
                        restoredIncorrectTopics[topicIndex] = true;
                      }
                    });

                    setIncorrectTopics(restoredIncorrectTopics);
                    setMissingTopics(
                      createdPlan.topicReview?.missingTopics || []
                    );

                    setReviewingTopics(true);
                  }
                }}
                className="rounded-md border border-[#dce5df] px-3 py-1.5 text-sm font-semibold text-[#42564a] hover:bg-[#f8faf9]"
              >
                {reviewingTopics ? "Finish Review" : "Review Topics"}
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {createdPlan.identifiedTopics.map((topic, topicIndex) => (
                <div
                  key={`${topic.name}-${topicIndex}`}
                  className="rounded-md border border-[#e5ebe7] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label
                      className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold ${
                        selectedTopicNames.includes(topic.name)
                          ? "border-[#8fb59d] bg-[#eef7f1] text-[#2f6b46]"
                          : "border-[#dce5df] bg-[#f8faf9] text-[#718077]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTopicNames.includes(topic.name)}
                        disabled={isConfirmingTopics}
                        onChange={() => handleToggleTopicSelection(topic.name)}
                        aria-label={`Include ${topic.name}`}
                        className="h-4 w-4 accent-[#2f6b46]"
                      />
                      {selectedTopicNames.includes(topic.name)
                        ? "Included"
                        : "Excluded"}
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTopics((current) => ({
                          ...current,
                          [topicIndex]: !current[topicIndex],
                        }))
                      }
                      className="flex flex-1 items-center justify-between text-left"
                    >
                      <h3 className="font-semibold text-[#33443a]">
                        {topic.name}
                      </h3>

                      <ChevronDown
                        className={`h-4 w-4 text-[#718077] transition-transform ${
                          expandedTopics[topicIndex] ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {reviewingTopics && (
                      <button
                        type="button"
                        onClick={() =>
                          setIncorrectTopics((current) => ({
                            ...current,
                            [topicIndex]: !current[topicIndex],
                          }))
                        }
                        className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                          incorrectTopics[topicIndex]
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-[#dce5df] text-[#607067] hover:bg-[#f8faf9]"
                        }`}
                      >
                        {incorrectTopics[topicIndex] ? "Marked Incorrect" : "Mark Incorrect"}
                      </button>
                    )}
                  </div>

                  {expandedTopics[topicIndex] && (
                    <>
                      {topic.concepts?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-bold uppercase text-[#718077]">
                            Important Concepts
                          </p>

                          <ul className="mt-2 space-y-2">
                            {topic.concepts.map((concept, conceptIndex) => (
                              <li key={`${concept.title}-${conceptIndex}`}>
                                <p className="text-sm font-semibold text-[#33443a]">
                                  {concept.title}
                                </p>
                                <p className="text-sm text-[#718077]">
                                  {concept.description}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {topic.subtopics?.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {topic.subtopics.map((subtopic, subtopicIndex) => (
                            <div
                              key={`${subtopic.name}-${subtopicIndex}`}
                              className="rounded-md bg-[#f8faf9] p-3"
                            >
                              <p className="text-sm font-semibold text-[#42564a]">
                                {subtopic.name}
                              </p>

                              {subtopic.concepts?.length > 0 && (
                                <ul className="mt-2 space-y-2">
                                  {subtopic.concepts.map((concept, conceptIndex) => (
                                    <li key={`${concept.title}-${conceptIndex}`}>
                                      <p className="text-sm font-medium text-[#33443a]">
                                        {concept.title}
                                      </p>
                                      <p className="text-sm text-[#718077]">
                                        {concept.description}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {reviewingTopics && (
              <div className="mt-4 rounded-md border border-dashed border-[#cfd9d2] bg-[#f8faf9] p-3">
                <p className="text-sm font-semibold text-[#42564a]">
                  Missing a topic?
                </p>

                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={missingTopicInput}
                    onChange={(event) => setMissingTopicInput(event.target.value)}
                    placeholder="Enter missing topic"
                    className="flex-1 rounded-md border border-[#dce5df] px-3 py-2 text-sm outline-none focus:border-[#8fb59d]"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const trimmedTopic = missingTopicInput.trim();

                      if (!trimmedTopic) return;

                      setMissingTopics((current) => [...current, trimmedTopic]);
                      setMissingTopicInput("");
                    }}
                    className="rounded-md bg-[#274c3a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1d3c2d]"
                  >
                    Add
                  </button>
                </div>

                {missingTopics.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {missingTopics.map((topic, index) => (
                      <p
                        key={`${topic}-${index}`}
                        className="text-sm text-[#526b5a]"
                      >
                        + {topic}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 border-t border-[#e5ebe7] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#33443a]">
                  {selectedTopicNames.length} of {createdPlan.identifiedTopics.length} topics selected
                </p>
                {topicConfirmationMessage && (
                  <p
                    role={topicConfirmationStatus === "error" ? "alert" : "status"}
                    aria-live="polite"
                    className={`mt-1 flex items-center gap-2 text-sm ${
                      topicConfirmationStatus === "error"
                        ? "text-[#9b3434]"
                        : topicConfirmationStatus === "success"
                          ? "text-[#2f6b46]"
                          : "text-[#607067]"
                    }`}
                  >
                    {topicConfirmationStatus === "error" && (
                      <AlertCircle className="h-4 w-4 shrink-0" />
                    )}
                    {topicConfirmationStatus === "success" && (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    )}
                    {topicConfirmationMessage}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleConfirmTopics}
                disabled={isConfirmingTopics}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#274c3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d3c2d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConfirmingTopics && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {isConfirmingTopics ? "Saving..." : "Confirm Topics"}
              </button>
            </div>
          </div>
        )}

        {createdPlan && (
          <ConfirmedTopicSchedule
            topics={createdPlan.confirmedTopics || []}
            isConfirmed={
              createdPlan.topicConfirmation?.status === "confirmed" &&
              topicConfirmationStatus === "success"
            }
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
      </div>
    );
  };

  // Main render method
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {!showCreate && (
        <StudyPlanSelector
          plans={savedPlans}
          selectedPlanId={planId}
          status={plansStatus}
          error={plansError}
          onSelect={handleSelectPlan}
        />
      )}
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

const ConfirmedTopicSchedule = ({ topics, isConfirmed }) => {
  if (!isConfirmed || topics.length === 0) {
    return null;
  }

  const hasSavedSchedule = topics.every((topic) =>
    Object.prototype.hasOwnProperty.call(topic, "scheduledDate")
  );
  if (!hasSavedSchedule) {
    return (
      <section className="rounded-lg border border-[#dce5df] bg-white p-4 shadow-[0_8px_30px_rgba(45,67,53,0.06)] sm:p-5">
        <h2 className="font-bold text-[#26372d]">Balanced topic schedule</h2>
        <p className="mt-1 text-sm text-[#718077]">
          Confirm your selected topics again to assign them across the remaining
          available study days.
        </p>
      </section>
    );
  }

  const scheduledTopicsByDate = topics.reduce((schedule, topic) => {
    if (!topic.scheduledDate) {
      return schedule;
    }

    if (!schedule[topic.scheduledDate]) {
      schedule[topic.scheduledDate] = [];
    }
    schedule[topic.scheduledDate].push(topic);
    return schedule;
  }, {});
  const scheduledDays = Object.entries(scheduledTopicsByDate).sort(
    ([firstDate], [secondDate]) => firstDate.localeCompare(secondDate)
  );

  return (
    <section className="rounded-lg border border-[#dce5df] bg-white p-4 shadow-[0_8px_30px_rgba(45,67,53,0.06)] sm:p-5">
      <h2 className="font-bold text-[#26372d]">Balanced topic schedule</h2>
      <p className="mt-1 text-sm text-[#718077]">
        Confirmed topics are spread across the remaining available study days.
      </p>
      {scheduledDays.length > 0 ? (
        <ol className="mt-4 space-y-3">
          {scheduledDays.map(([studyDate, dayTopics]) => (
            <li
              key={studyDate}
              className="rounded-md border border-[#e5ebe7] bg-[#f8faf9] p-3"
            >
              <h3 className="text-sm font-semibold text-[#33443a]">
                {formatPlanDate(studyDate)}
              </h3>
              <ul className="mt-2 space-y-1">
                {dayTopics.map((topic, index) => (
                  <li
                    key={`${topic.name}-${index}`}
                    className="text-sm text-[#607067]"
                  >
                    {topic.name}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 rounded-md border border-[#ead7b4] bg-[#fff9eb] p-3 text-sm text-[#795d2d]">
          No available study days remain before the exam. Update the plan dates
          to schedule these topics.
        </p>
      )}
    </section>
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

const getInitialSelectedTopicNames = (plan) => {
  const identifiedTopics = Array.isArray(plan?.identifiedTopics)
    ? plan.identifiedTopics.filter(
        (topic) => typeof topic?.name === "string" && topic.name.trim()
      )
    : [];
  const availableTopics = new Map(
    identifiedTopics.map((topic) => [
      topic.name.trim().toLowerCase(),
      topic.name,
    ])
  );

  if (plan?.topicConfirmation?.status !== "confirmed") {
    return identifiedTopics.map((topic) => topic.name);
  }

  const savedNames = Array.isArray(plan.topicConfirmation.topicNames)
    ? plan.topicConfirmation.topicNames
    : [];
  const fallbackNames = Array.isArray(plan.confirmedTopics)
    ? plan.confirmedTopics
        .map((topic) => topic?.name)
        .filter((name) => typeof name === "string")
    : [];

  return [...new Set(savedNames.length > 0 ? savedNames : fallbackNames)]
    .map((name) => availableTopics.get(String(name).toLowerCase()))
    .filter(Boolean);
};

const normalizeStructuredPlan = (studyPlanDocument) => ({
  id: studyPlanDocument.id,
  ...studyPlanDocument.data,
  activities: studyPlanDocument.data?.activities || [],
  materials: studyPlanDocument.data?.materials || [],
});

const toStudyPlanSummary = (plan, existingSummary = {}) => ({
  ...existingSummary,
  id: plan.id,
  title: plan.examName || plan.title || "Untitled study plan",
  examName: plan.examName || null,
  subject: plan.subject || null,
  studyStartDate: plan.studyStartDate || null,
  examDate: plan.examDate || null,
  activityCount: Array.isArray(plan.activities)
    ? plan.activities.length
    : existingSummary.activityCount || 0,
  createdAt: existingSummary.createdAt || plan.createdAt || new Date().toISOString(),
  updatedAt: plan.updatedAt || new Date().toISOString(),
});

export default StudyPlans;
