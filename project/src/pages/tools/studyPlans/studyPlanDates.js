const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const parseDateValue = (value) => {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return date;
};

export const formatDateValue = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

export const getAvailableStudyDays = (
  startDate,
  endDate,
  unavailableDays = []
) => {
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);
  if (!start || !end || start > end) return [];

  const unavailable = new Set(
    (Array.isArray(unavailableDays) ? unavailableDays : [])
      .map((day) => String(day).trim().toLowerCase())
  );
  const days = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const weekday = WEEKDAYS[cursor.getDay()];
    if (!unavailable.has(weekday)) {
      days.push({
        value: formatDateValue(cursor),
        label: new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(cursor),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};
