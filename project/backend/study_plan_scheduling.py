from datetime import date
from typing import Any, Dict, List


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
