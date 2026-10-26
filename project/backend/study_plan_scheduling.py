from datetime import date
from typing import Any, Dict, List, Tuple


REVIEW_ACTIVITY_MINUTES = 30


def verify_topics_scheduled_before_exam(
    topics: List[Dict[str, Any]],
    exam_date: str,
) -> None:
    try:
        exam_day = date.fromisoformat(exam_date)
    except (TypeError, ValueError) as error:
        raise ValueError("Exam date must be a valid date.") from error

    for topic in topics:
        scheduled_date = topic.get("scheduledDate")
        try:
            scheduled_day = date.fromisoformat(scheduled_date)
        except (TypeError, ValueError) as error:
            raise ValueError(
                "Every selected topic must be scheduled before the exam."
            ) from error

        if scheduled_day >= exam_day:
            raise ValueError(
                "Every selected topic must be scheduled before the exam."
            )


def distribute_topics_across_study_days(
    topics: List[Dict[str, Any]],
    study_days: List[str],
) -> List[Dict[str, Any]]:
    if not topics:
        return []

    if not study_days:
        return [{**topic, "scheduledDate": None} for topic in topics]

    topic_count = len(topics)
    day_count = len(study_days)
    scheduled_topics = []

    for index, topic in enumerate(topics):
        if topic_count >= day_count:
            day_index = index * day_count // topic_count
        elif topic_count == 1:
            day_index = 0
        else:
            day_index = round(index * (day_count - 1) / (topic_count - 1))

        scheduled_topics.append(
            {**topic, "scheduledDate": study_days[day_index]}
        )

    return scheduled_topics


def schedule_review_activities(
    confirmed_topics: List[Dict[str, Any]],
    review_topic_names: List[str],
    study_days: List[str],
    daily_study_minutes: int,
    existing_activities: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[str]]:
    if (
        not isinstance(daily_study_minutes, int)
        or isinstance(daily_study_minutes, bool)
        or daily_study_minutes <= 0
    ):
        raise ValueError("Daily study time must be greater than zero.")

    review_minutes = min(REVIEW_ACTIVITY_MINUTES, daily_study_minutes)
    available_days = sorted(set(study_days))
    minutes_by_day = {study_day: 0 for study_day in available_days}

    for activity in existing_activities:
        study_day = activity.get("studyDate")
        if study_day not in minutes_by_day:
            continue
        minutes = activity.get("estimatedMinutes")
        if isinstance(minutes, int) and not isinstance(minutes, bool) and minutes > 0:
            minutes_by_day[study_day] += minutes

    topics_by_name = {
        str(topic.get("name") or "").strip().casefold(): topic
        for topic in confirmed_topics
        if isinstance(topic, dict) and str(topic.get("name") or "").strip()
    }
    scheduled_reviews = []
    unscheduled_topics = []
    seen_topics = set()

    for topic_name in review_topic_names:
        normalized_name = str(topic_name or "").strip().casefold()
        if not normalized_name or normalized_name in seen_topics:
            continue
        seen_topics.add(normalized_name)

        topic = topics_by_name.get(normalized_name)
        topic_date = topic.get("scheduledDate") if topic else None
        if not topic_date:
            unscheduled_topics.append(str(topic_name).strip())
            continue

        review_date = next(
            (
                study_day
                for study_day in available_days
                if study_day > topic_date
                and minutes_by_day[study_day] + review_minutes
                <= daily_study_minutes
            ),
            None,
        )
        if review_date is None:
            unscheduled_topics.append(str(topic_name).strip())
            continue

        minutes_by_day[review_date] += review_minutes
        scheduled_reviews.append(
            {
                "topic": str(topic.get("name") or "").strip(),
                "studyDate": review_date,
                "estimatedMinutes": review_minutes,
            }
        )

    return scheduled_reviews, unscheduled_topics
