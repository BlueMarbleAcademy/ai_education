import React from "react";
import { getStudyPlanProgress } from "./studyPlanProgressMetrics";

const StudyPlanProgress = ({ plan, isSaving = false }) => {
  const { total, completed, percentage, allCompleted } = getStudyPlanProgress(plan.activities);

  return (
    <section aria-labelledby="study-plan-progress-heading" aria-busy={isSaving} className="space-y-3 border-y border-gray-200 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="study-plan-progress-heading" className="font-bold text-gray-900">Study plan progress</h2>
          <p className="mt-1 break-words text-sm text-gray-600">{plan.examName}</p>
        </div>
        <p className="w-16 shrink-0 text-right text-2xl font-bold tabular-nums text-blue-700">{percentage}%</p>
      </div>
      <div
        role="progressbar"
        aria-label={`Study plan progress: ${plan.examName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={`${completed} of ${total} activities completed`}
        className="h-3 overflow-hidden rounded-md bg-gray-200"
      >
        <div className="h-full bg-blue-600" style={{ width: `${percentage}%` }} />
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-gray-600">
        {total === 0
          ? "No study activities yet. Add activities to start tracking your progress."
          : `${completed} of ${total} activities completed.${allCompleted ? " All study activities completed." : ""}`}
      </p>
    </section>
  );
};

export default StudyPlanProgress;
