from datetime import date, timedelta
from typing import List


VALID_WEEKDAYS = {
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
}


def calculate_available_study_days(
    study_start_date: str,
    exam_date: str,
    unavailable_days: List[str],
) -> List[str]:
    try:
        start_date = date.fromisoformat(study_start_date)
        end_date = date.fromisoformat(exam_date)
    except (TypeError, ValueError) as error:
        raise ValueError(
            "Study start date and exam date must be valid dates."
        ) from error

    if end_date <= start_date:
        raise ValueError("Exam date must be after the study start date.")

    unavailable = {str(day).strip().lower() for day in unavailable_days}
    if not unavailable.issubset(VALID_WEEKDAYS):
        raise ValueError("Unavailable days must be valid weekdays.")

    available_days = []
    current_date = start_date
    while current_date <= end_date:
        if current_date.strftime("%A").lower() not in unavailable:
            available_days.append(current_date.isoformat())
        current_date += timedelta(days=1)

    if not available_days:
        raise ValueError("No study days are available in this date range.")

    return available_days
