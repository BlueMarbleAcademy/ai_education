import React from "react";
import { CalendarDays, CheckCircle2 } from "lucide-react";

const StudyPlanSelector = ({
  plans,
  selectedPlanId,
  status,
  error,
  onSelect,
}) => (
  <section aria-labelledby="saved-plans-heading" className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 id="saved-plans-heading" className="text-lg font-bold text-[#26372d]">
          Your study plans
        </h2>
        <p className="mt-1 text-sm text-[#718077]">
          Choose a plan to view its activities and calendar.
        </p>
      </div>
      {status === "ready" && plans.length > 0 && (
        <span className="text-sm font-medium text-[#718077]">
          {plans.length} saved plan{plans.length === 1 ? "" : "s"}
        </span>
      )}
    </div>

    {status === "loading" && (
      <p role="status" className="text-sm font-medium text-[#73549a]">
        Loading your study plans...
      </p>
    )}

    {error && (
      <p role="alert" className="rounded-md border border-[#e6b8b8] bg-[#fff3f3] px-4 py-3 text-sm font-medium text-[#9b3434]">
        {error}
      </p>
    )}

    {status === "ready" && plans.length === 0 && (
      <div className="rounded-md border border-dashed border-[#cfdad2] px-4 py-5 text-sm text-[#68766d]">
        You have not created a study plan yet.
      </div>
    )}

    {plans.length > 0 && (
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const isSelected = plan.id === selectedPlanId;
          const details = getPlanDetails(plan);

          return (
            <button
              key={plan.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(plan.id)}
              className={`min-w-0 rounded-md border px-3 py-3 text-left transition ${
                isSelected
                  ? "border-[#8f6fba] bg-[#f4effa] shadow-sm"
                  : "border-[#dce5df] bg-white hover:border-[#bca8d4] hover:bg-[#fbf9fd]"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <CalendarDays className={`h-4 w-4 shrink-0 ${isSelected ? "text-[#6941a5]" : "text-[#718077]"}`} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#26372d]">
                  {plan.title || plan.examName || "Untitled study plan"}
                </span>
                {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6941a5]" />}
              </span>
              <span className="mt-1.5 block truncate text-xs text-[#718077]">
                {details}
              </span>
            </button>
          );
        })}
      </div>
    )}
  </section>
);

const getPlanDetails = (plan) => {
  const parts = [];

  if (plan.subject) {
    parts.push(plan.subject);
  }
  if (plan.examDate) {
    parts.push(`Exam ${formatShortDate(plan.examDate)}`);
  }
  if (Number.isInteger(plan.activityCount)) {
    parts.push(
      `${plan.activityCount} activit${plan.activityCount === 1 ? "y" : "ies"}`
    );
  }
  if (parts.length === 0 && plan.createdAt) {
    parts.push(`Created ${formatShortDate(plan.createdAt)}`);
  }

  return parts.join(" · ") || "Saved study plan";
};

const formatShortDate = (value) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value || "")
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export default StudyPlanSelector;
