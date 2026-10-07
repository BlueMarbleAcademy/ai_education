const CALENDAR_HOURS = 11;
const MINIMUM_VISIBLE_MINUTES = 60;

export const ACTIVITY_TYPE_STYLES = {
  reading: "border-[#a9c4db] bg-[#eef6fb] text-[#315f95]",
  notes: "border-[#d4b783] bg-[#fff8e9] text-[#81551d]",
  flashcards: "border-[#c9b6df] bg-[#f4effa] text-[#6941a5]",
  practice_quiz: "border-[#d7a8a8] bg-[#fff1f1] text-[#8f3f3f]",
  video: "border-[#9ec7b1] bg-[#eef8f2] text-[#37684c]",
  review: "border-[#b8c3a4] bg-[#f5f8ef] text-[#53633a]",
};

const ACTIVITY_TYPE_LABELS = {
  reading: "Reading",
  notes: "Notes",
  flashcards: "Flashcards",
  practice_quiz: "Practice quiz",
  video: "Video lesson",
  review: "Review session",
};

export const buildCalendarBlocks = (activities, weekDates) => {
  const dayIndexes = new Map(
    weekDates.map((date, index) => [formatDateValue(date), index])
  );
  const minutesUsedByDay = new Map();

  return [...(activities || [])]
    .filter((activity) => dayIndexes.has(activity.studyDate))
    .sort(compareActivities)
    .map((activity) => {
      const day = dayIndexes.get(activity.studyDate);
      const estimatedMinutes = normalizeMinutes(activity.estimatedMinutes);
      const startMinutes = minutesUsedByDay.get(day) || 0;
      const visibleMinutes = Math.max(estimatedMinutes, MINIMUM_VISIBLE_MINUTES);
      const remainingMinutes = Math.max(
        MINIMUM_VISIBLE_MINUTES,
        CALENDAR_HOURS * 60 - startMinutes
      );

      minutesUsedByDay.set(day, startMinutes + visibleMinutes);

      return {
        id: activity.id,
        title: activity.topic,
        meta: `${getActivityTypeLabel(activity.activityType)} · ${estimatedMinutes} min`,
        day,
        start: startMinutes / 60,
        span: Math.min(visibleMinutes, remainingMinutes) / 60,
        completed: Boolean(activity.completed),
        color:
          ACTIVITY_TYPE_STYLES[activity.activityType] ||
          "border-[#cfdad2] bg-[#f3f7f4] text-[#385445]",
      };
    });
};

export const getWeekActivities = (activities, weekDates) => {
  const weekDateValues = new Set(weekDates.map(formatDateValue));
  return (activities || []).filter((activity) =>
    weekDateValues.has(activity.studyDate)
  );
};

export const getWeekOffsetForDate = (dateValue, today = new Date()) => {
  const targetDate = parseDateValue(dateValue);
  if (!targetDate) {
    return 0;
  }

  const currentWeekStart = getWeekStart(today);
  const targetWeekStart = getWeekStart(targetDate);
  const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;

  return Math.round(
    (toUtcDateValue(targetWeekStart) - toUtcDateValue(currentWeekStart)) /
      millisecondsPerWeek
  );
};

export const getPlanFocusDate = (plan, today = new Date()) => {
  const todayValue = formatDateValue(today);
  const activities = [...(plan?.activities || [])].sort(compareActivities);
  const upcomingActivity = activities.find(
    (activity) => !activity.completed && activity.studyDate >= todayValue
  );

  return (
    upcomingActivity?.studyDate ||
    activities.find((activity) => !activity.completed)?.studyDate ||
    activities[0]?.studyDate ||
    plan?.studyStartDate ||
    null
  );
};

export const formatPlannedTime = (minutes) => {
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hourLabel = `${hours} hour${hours === 1 ? "" : "s"}`;

  return remainingMinutes > 0
    ? `${hourLabel} ${remainingMinutes} minutes`
    : hourLabel;
};

const getActivityTypeLabel = (value) =>
  ACTIVITY_TYPE_LABELS[value] || value || "Study activity";

const normalizeMinutes = (value) => {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 30;
};

const compareActivities = (first, second) => {
  const dateOrder = (first.studyDate || "").localeCompare(second.studyDate || "");
  if (dateOrder !== 0) {
    return dateOrder;
  }

  const createdOrder = (first.createdAt || "").localeCompare(
    second.createdAt || ""
  );
  return createdOrder || (first.topic || "").localeCompare(second.topic || "");
};

const formatDateValue = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const parseDateValue = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return null;
  }

  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getWeekStart = (date) => {
  const weekStart = new Date(date);
  weekStart.setHours(12, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return weekStart;
};

const toUtcDateValue = (date) =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
