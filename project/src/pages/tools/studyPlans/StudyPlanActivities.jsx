import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  ListChecks,
  Plus,
} from "lucide-react";
import { getAvailableStudyDays } from "./studyPlanDates";

const ACTIVITY_TYPES = [
  { value: "reading", label: "Reading" },
  { value: "reading_review", label: "Reading / review" },
  { value: "notes", label: "Notes" },
  { value: "flashcards", label: "Flashcards" },
  { value: "practice_quiz", label: "Practice quiz" },
  { value: "mind_map", label: "Mind map" },
  { value: "voice_memo", label: "Voice memo" },
  { value: "video", label: "Video lesson" },
  { value: "review", label: "Review activity" },
];

const STUDY_METHOD_LABELS = {
  study: "Reading / review",
  reading_review: "Reading / review",
  flashcards: "Flashcards",
  practice_quiz: "Practice quiz",
  mind_map: "Mind map",
  voice_memo: "Voice memo",
};

const INITIAL_ACTIVITY = {
  topic: "",
  activityType: "",
  estimatedMinutes: "",
  studyDate: "",
};

const StudyPlanActivities = ({
  plan,
  onAddActivity,
  onToggleActivity,
  isSaving = false,
  error = "",
}) => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const activities = plan.activities || [];
  const sortedActivities = [...activities].sort(compareActivities);
  const completedCount = activities.filter((activity) => activity.completed).length;
  const upcomingCount = activities.length - completedCount;

  const handleAdd = async (activity) => {
    try {
      await onAddActivity(activity);
      setShowForm(false);
    } catch {
      // The parent displays the API error and keeps this form open for retrying.
    }
  };

  return (
    <section
      aria-labelledby="plan-activities-heading"
      className="rounded-lg border border-[#dce5df] bg-white p-4 shadow-[0_8px_30px_rgba(45,67,53,0.06)] sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-[#e7eef8] p-2 text-[#315f95]">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <h2 id="plan-activities-heading" className="font-bold text-[#26372d]">
              Upcoming study activities
            </h2>
            <p className="mt-0.5 text-sm text-[#718077]">
              {activities.length === 0
                ? "Add the work you want to complete before your exam."
                : `${upcomingCount} upcoming · ${completedCount} completed`}
            </p>
          </div>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#5b3a8c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#472b70]"
          >
            <Plus className="h-4 w-4" />
            Add study activity
          </button>
        )}
      </div>

      {showForm && (
        <ActivityForm
          plan={plan}
          onAdd={handleAdd}
          onCancel={() => setShowForm(false)}
          isSaving={isSaving}
        />
      )}

      {error && (
        <p role="alert" className="mt-4 flex items-center gap-2 rounded-md border border-[#e6b8b8] bg-[#fff3f3] px-3 py-2 text-sm font-medium text-[#9b3434]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {!showForm && activities.length === 0 && (
        <div className="mt-5 border-t border-[#e5ebe7] pt-5 text-center">
          <CalendarDays className="mx-auto h-7 w-7 text-[#9aa79f]" />
          <p className="mt-2 text-sm font-medium text-[#68766d]">
            No upcoming study activities yet
          </p>
        </div>
      )}

      {activities.length > 0 && (
        <ol className="mt-5 divide-y divide-[#e5ebe7] border-t border-[#e5ebe7]">
          {sortedActivities.map((activity) => (
            <li
              key={activity.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  aria-label={`${activity.completed ? "Mark incomplete" : "Mark complete"}: ${activity.instruction || activity.topic}`}
                  aria-pressed={activity.completed}
                  onClick={() => onToggleActivity(activity.id)}
                  disabled={isSaving}
                  className={`mt-0.5 rounded-md p-1 transition ${
                    activity.completed
                      ? "text-[#6941a5] hover:bg-[#f4effa]"
                      : "text-[#829087] hover:bg-[#f7f3fa]"
                  } disabled:cursor-wait disabled:opacity-50`}
                >
                  {activity.completed ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3
                      className={`truncate text-sm font-bold ${
                        activity.completed
                          ? "text-[#77847c] line-through"
                          : "text-[#26372d]"
                      }`}
                    >
                      {activity.instruction || activity.topic}
                    </h3>
                    {activity.activityType === "review" && (
                      <span className="shrink-0 rounded-full bg-[#f5f8ef] px-2 py-0.5 text-[11px] font-semibold text-[#53633a]">
                        {activity.generatedBy === "final-review" ? "Final review" : activity.generatedBy === "automatic-review" ? "Spaced review" : "Review activity"}
                      </span>
                    )}
                    {activity.studyMethod && (
                      <span className="shrink-0 rounded-full bg-[#f5f8ef] px-2 py-0.5 text-[11px] font-semibold text-[#53633a]">
                        {getStudyMethodLabel(activity)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#718077]">
                    {`${getStudyMethodLabel(activity)} · `}
                    <time dateTime={activity.studyDate}>
                      {formatPlanDate(activity.studyDate)}
                    </time>
                  </p>
                  {activity.topicNames?.length > 0 && (
                    <p className="mt-1 break-words text-xs text-[#607067]">Topics: {activity.topicNames.join(", ")}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 pl-9 sm:pl-0">
                {isPracticeQuizActivity(activity) && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/tools/practice-tests", {
                        state: {
                          topic:
                            activity.topic ||
                            activity.instruction ||
                            activity.topicNames?.[0] ||
                            "General practice",
                          autoStart: true,
                        },
                      })
                    }
                    className="inline-flex items-center justify-center rounded-md border border-[#c8a5d9] bg-[#f6f0fc] px-2.5 py-1.5 text-xs font-semibold text-[#5b3a8c] transition hover:bg-[#efe3fa]"
                  >
                    Practice quiz
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#607067]">
                  <Clock3 className="h-3.5 w-3.5" />
                  {activity.estimatedMinutes} minutes
                </span>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    activity.completed
                      ? "bg-[#eadcf5] text-[#6941a5]"
                      : "bg-[#eef2f0] text-[#66746c]"
                  }`}
                >
                  {activity.completed ? "Completed" : "Planned"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

const ActivityForm = ({ plan, onAdd, onCancel, isSaving }) => {
  const [form, setForm] = useState(INITIAL_ACTIVITY);
  const [errors, setErrors] = useState({});
  const studyDays = useMemo(() => getStudyDays(plan), [plan]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    const estimatedMinutes = Number(form.estimatedMinutes);

    if (!form.topic.trim()) {
      nextErrors.topic = "Enter an activity topic.";
    }
    if (!form.activityType) {
      nextErrors.activityType = "Select an activity type.";
    }
    if (!form.estimatedMinutes) {
      nextErrors.estimatedMinutes = "Enter an estimated time.";
    } else if (
      !Number.isFinite(estimatedMinutes) ||
      estimatedMinutes < 5 ||
      estimatedMinutes > 720
    ) {
      nextErrors.estimatedMinutes = "Enter between 5 and 720 minutes.";
    }
    if (!form.studyDate) {
      nextErrors.studyDate = "Select a study day.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onAdd({
      id: `activity-${Date.now()}`,
      topic: form.topic.trim(),
      activityType: form.activityType,
      estimatedMinutes,
      studyDate: form.studyDate,
      completed: false,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-5 border-t border-[#e5ebe7] pt-5"
    >
      <h3 className="text-sm font-bold text-[#26372d]">Add a study activity</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field htmlFor="activity-topic" label="Topic" error={errors.topic}>
          <input
            id="activity-topic"
            type="text"
            value={form.topic}
            onChange={(event) => updateField("topic", event.target.value)}
            placeholder="For example, Derivative rules"
            required
            aria-invalid={Boolean(errors.topic)}
            className={inputClasses(errors.topic)}
          />
        </Field>

        <Field
          htmlFor="activity-type"
          label="Activity type"
          error={errors.activityType}
        >
          <select
            id="activity-type"
            value={form.activityType}
            onChange={(event) => updateField("activityType", event.target.value)}
            required
            aria-invalid={Boolean(errors.activityType)}
            className={inputClasses(errors.activityType)}
          >
            <option value="">Select a type</option>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          htmlFor="activity-time"
          label="Estimated time"
          error={errors.estimatedMinutes}
        >
          <div className="relative">
            <input
              id="activity-time"
              type="number"
              min="5"
              max="720"
              step="5"
              value={form.estimatedMinutes}
              onChange={(event) =>
                updateField("estimatedMinutes", event.target.value)
              }
              placeholder="30"
              required
              aria-invalid={Boolean(errors.estimatedMinutes)}
              className={`${inputClasses(errors.estimatedMinutes)} pr-24`}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[#718077]">
              minutes
            </span>
          </div>
        </Field>

        <Field htmlFor="activity-day" label="Study day" error={errors.studyDate}>
          <select
            id="activity-day"
            value={form.studyDate}
            onChange={(event) => updateField("studyDate", event.target.value)}
            required
            disabled={studyDays.length === 0}
            aria-invalid={Boolean(errors.studyDate)}
            className={`${inputClasses(errors.studyDate)} disabled:cursor-not-allowed disabled:bg-[#f2f4f3]`}
          >
            <option value="">
              {studyDays.length === 0 ? "No available study days" : "Select a day"}
            </option>
            {studyDays.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {studyDays.length === 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs font-medium text-[#b54747]">
          <AlertCircle className="h-3.5 w-3.5" />
          This plan has no available study days. Update its dates or unavailable days.
        </p>
      )}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-md border border-[#cfdad2] bg-white px-4 py-2.5 text-sm font-semibold text-[#526259] transition hover:bg-[#f3f7f4]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={studyDays.length === 0 || isSaving}
          className="rounded-md bg-[#5b3a8c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#472b70] disabled:cursor-not-allowed disabled:bg-[#9ba9a1]"
        >
          {isSaving ? "Saving..." : "Add activity"}
        </button>
      </div>
    </form>
  );
};

const Field = ({ htmlFor, label, error, children }) => (
  <div>
    <label htmlFor={htmlFor} className="text-sm font-semibold text-[#33443a]">
      {label} <span className="text-[#b54747]">*</span>
    </label>
    <div className="mt-2">{children}</div>
    {error && (
      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#b54747]">
        <AlertCircle className="h-3.5 w-3.5" />
        {error}
      </p>
    )}
  </div>
);

const getStudyDays = (plan) => {
  return getAvailableStudyDays(
    plan.studyStartDate,
    plan.examDate,
    plan.unavailableDays
  );
};

const formatPlanDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));

const getActivityTypeLabel = (value) =>
  ACTIVITY_TYPES.find((type) => type.value === value)?.label || value;

const getStudyMethodLabel = (activity) =>
  STUDY_METHOD_LABELS[activity.studyMethod] ||
  getActivityTypeLabel(activity.activityType) ||
  "Study activity";

const isPracticeQuizActivity = (activity) => {
  const studyMethod = activity?.studyMethod || activity?.activityType;
  return studyMethod === "practice_quiz";
};

const compareActivities = (first, second) => {
  const dateOrder = first.studyDate.localeCompare(second.studyDate);
  if (dateOrder !== 0) {
    return dateOrder;
  }

  if (
    first.topic === second.topic &&
    first.generatedBy === "day-plan" && second.generatedBy === "day-plan" &&
    Number.isInteger(first.stepOrder) && Number.isInteger(second.stepOrder)
  ) {
    return first.stepOrder - second.stepOrder;
  }

  const createdOrder = (first.createdAt || "").localeCompare(
    second.createdAt || ""
  );
  return createdOrder || first.topic.localeCompare(second.topic);
};

const inputClasses = (hasError) =>
  `w-full rounded-md border bg-white px-3 py-2.5 text-sm text-[#26372d] outline-none transition focus:ring-2 ${
    hasError
      ? "border-[#cf6666] focus:border-[#cf6666] focus:ring-[#f1cccc]"
      : "border-[#cfdad2] focus:border-[#8060a8] focus:ring-[#e4d8f0]"
  }`;

export default StudyPlanActivities;
