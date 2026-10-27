import re
from datetime import date
from typing import Any, Dict, List, Tuple


REVIEW_ACTIVITY_MINUTES = 30
DEFAULT_STUDY_METHOD = "reading_review"
SUPPORTED_STUDY_METHODS = {
    DEFAULT_STUDY_METHOD,
    "flashcards",
    "practice_quiz",
    "mind_map",
    "voice_memo",
}

STUDY_METHOD_KEYWORDS = (
    (
        "voice_memo",
        {
            "conversation",
            "debate",
            "interview",
            "language practice",
            "listening",
            "oral",
            "presentation",
            "pronunciation",
            "speaking",
            "speech",
        },
    ),
    (
        "practice_quiz",
        {
            "accounting",
            "algebra",
            "algorithm",
            "calculation",
            "calculus",
            "chemistry",
            "coding",
            "debugging",
            "equation",
            "exercise",
            "formula",
            "math",
            "mathematics",
            "physics",
            "problem solving",
            "programming",
            "statistics",
        },
    ),
    (
        "flashcards",
        {
            "anatomy",
            "date",
            "definition",
            "fact",
            "memorization",
            "name",
            "terminology",
            "term",
            "vocabulary",
        },
    ),
    (
        "mind_map",
        {
            "architecture",
            "cause and effect",
            "comparison",
            "connection",
            "cycle",
            "framework",
            "hierarchy",
            "process",
            "relationship",
            "system",
        },
    ),
)


def assign_study_method(topic: Dict[str, Any]) -> str:
    """Choose a supported study method from a topic's structured content."""
    text_parts = [str(topic.get("name") or "")]

    for concept in topic.get("concepts", []) or []:
        if isinstance(concept, dict):
            text_parts.extend(
                [
                    str(concept.get("title") or concept.get("name") or ""),
                    str(concept.get("description") or ""),
                ]
            )
        else:
            text_parts.append(str(concept or ""))

    for subtopic in topic.get("subtopics", []) or []:
        if not isinstance(subtopic, dict):
            text_parts.append(str(subtopic or ""))
            continue

        text_parts.append(str(subtopic.get("name") or ""))
        for concept in subtopic.get("concepts", []) or []:
            if isinstance(concept, dict):
                text_parts.extend(
                    [
                        str(concept.get("title") or concept.get("name") or ""),
                        str(concept.get("description") or ""),
                    ]
                )
            else:
                text_parts.append(str(concept or ""))

    normalized_text = " ".join(
        re.sub(r"[^a-z0-9+]+", " ", part.casefold()).strip()
        for part in text_parts
        if part
    )
    # Normalize simple plurals so 'definitions' and 'processes' match as well.
    words = normalized_text.split()
    variants = set(words)
    for word in words:
        if word.endswith("ies"):
            variants.add(word[:-3] + "y")
        elif word.endswith("ses"):
            variants.add(word[:-2])
        elif word.endswith("s") and not word.endswith("ss"):
            variants.add(word[:-1])
    padded_text = f" {normalized_text} "

    for method, keywords in STUDY_METHOD_KEYWORDS:
        if any(keyword in variants or f" {keyword} " in padded_text for keyword in keywords):
            return method

    return DEFAULT_STUDY_METHOD


def build_topic_study_steps(topic: Dict[str, Any], minutes: int) -> List[Dict[str, Any]]:
    preferred_method = assign_study_method(topic)
    methods = [DEFAULT_STUDY_METHOD, preferred_method, "practice_quiz"]
    if preferred_method == DEFAULT_STUDY_METHOD:
        methods[1] = "voice_memo"
    methods = list(dict.fromkeys(methods))
    if minutes < 10:
        methods = [preferred_method]
    elif minutes < len(methods) * 5:
        methods = [DEFAULT_STUDY_METHOD, preferred_method if preferred_method != DEFAULT_STUDY_METHOD else "practice_quiz"]

    step_minutes, extra_minutes = divmod(minutes, len(methods))
    actions = {
        "reading_review": "Review uploaded material",
        "flashcards": "Practice key terms with flashcards",
        "practice_quiz": "Test your understanding with a practice quiz",
        "mind_map": "Connect the concepts in a mind map",
        "voice_memo": "Explain the topic from memory in a voice memo",
    }
    return [
        {
            "studyMethod": method,
            "estimatedMinutes": step_minutes + (index < extra_minutes),
            "instruction": f"{actions[method]}: {topic['name'].strip()}",
            "stepOrder": index,
        }
        for index, method in enumerate(methods)
    ]


def ensure_generated_activity_study_methods(
    activities: List[Dict[str, Any]],
    confirmed_topics: List[Dict[str, Any]],
) -> bool:
    """Backfill methods for generated activities saved before this feature."""
    topics_by_name = {
        str(topic.get("name") or "").strip().casefold(): topic
        for topic in confirmed_topics
        if isinstance(topic, dict) and str(topic.get("name") or "").strip()
    }
    changed = False

    for activity in activities:
        if not isinstance(activity, dict):
            continue
        if activity.get("generatedBy") not in {"day-plan", "topic-review"}:
            continue
        if activity.get("studyMethod") in SUPPORTED_STUDY_METHODS:
            continue

        if activity.get("generatedBy") == "topic-review":
            study_method = DEFAULT_STUDY_METHOD
        else:
            topic_name = str(activity.get("topic") or "").strip()
            topic = topics_by_name.get(topic_name.casefold(), {"name": topic_name})
            study_method = assign_study_method(topic)

        activity["studyMethod"] = study_method
        changed = True

    return changed


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

def generate_day_by_day_activities(
    confirmed_topics: List[Dict[str, Any]],
    daily_study_minutes: int,
    existing_activities: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if (
        not isinstance(daily_study_minutes, int)
        or isinstance(daily_study_minutes, bool)
        or daily_study_minutes <= 0
    ):
        raise ValueError("Daily study time must be greater than zero.")

    topics_by_day: Dict[str, List[Dict[str, Any]]] = {}

    for topic in confirmed_topics:
        topic_name = str(topic.get("name") or "").strip()
        study_day = topic.get("scheduledDate")

        if not topic_name or not isinstance(study_day, str) or not study_day:
            raise ValueError(
                "Every confirmed topic must have a scheduled study day."
            )

        topics_by_day.setdefault(study_day, []).append(topic)

    # Count time already being used by manual/review activities.
    # Existing generated day-plan activities are ignored so the plan
    # can safely be regenerated later.
    minutes_by_day: Dict[str, int] = {}

    for activity in existing_activities:
        if activity.get("generatedBy") == "day-plan":
            continue

        study_day = activity.get("studyDate")
        minutes = activity.get("estimatedMinutes")

        if (
            isinstance(study_day, str)
            and isinstance(minutes, int)
            and not isinstance(minutes, bool)
            and minutes > 0
        ):
            minutes_by_day[study_day] = (
                minutes_by_day.get(study_day, 0) + minutes
            )

    generated_activities = []

    for study_day in sorted(topics_by_day):
        day_topics = topics_by_day[study_day]

        used_minutes = minutes_by_day.get(study_day, 0)
        remaining_minutes = daily_study_minutes - used_minutes

        minimum_required = len(day_topics) * 5

        if remaining_minutes < minimum_required:
            raise ValueError(
                f"Not enough study time is available on {study_day} "
                "to schedule all confirmed topics."
            )

        minutes_per_topic, extra_minutes = divmod(
            remaining_minutes,
            len(day_topics),
        )

        for index, topic in enumerate(day_topics):
            topic_name = str(topic.get("name") or "").strip()
            estimated_minutes = minutes_per_topic

            if index < extra_minutes:
                estimated_minutes += 1

            for step in build_topic_study_steps(topic, estimated_minutes):
                generated_activities.append({
                    "topic": topic_name,
                    "studyDate": study_day,
                    **step,
                })

    return generated_activities

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
    # Leave at least five minutes for each topic's initial study session.
    for topic in confirmed_topics:
        study_day = topic.get("scheduledDate")
        if study_day in minutes_by_day:
            minutes_by_day[study_day] += 5
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
                and minutes_by_day[study_day] + 5
                <= daily_study_minutes
            ),
            None,
        )
        if review_date is None:
            unscheduled_topics.append(str(topic_name).strip())
            continue

        allocated_minutes = min(
            review_minutes, daily_study_minutes - minutes_by_day[review_date]
        )
        minutes_by_day[review_date] += allocated_minutes
        scheduled_reviews.append(
            {
                "topic": str(topic.get("name") or "").strip(),
                "studyDate": review_date,
                "estimatedMinutes": allocated_minutes,
                "studyMethod": DEFAULT_STUDY_METHOD,
            }
        )

    return scheduled_reviews, unscheduled_topics
