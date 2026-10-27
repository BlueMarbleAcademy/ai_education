import copy
import uuid
from collections import defaultdict

from study_plan_scheduling import assign_study_method, build_topic_study_steps, distribute_topics_across_study_days


GENERATED_KINDS = {"day-plan", "topic-review", "automatic-review", "final-review"}


def _key(activity):
    return (activity.get("generatedBy"), activity.get("topic", "").casefold(), activity.get("studyMethod"), activity.get("reviewRound", 0))


def build_exam_schedule(plan_id, topics, study_days, daily_minutes, existing, flagged_topics=()):
    if not study_days or daily_minutes < 5:
        raise ValueError("No study time remains before the exam. Change the dates or available study time.")
    topics = copy.deepcopy(topics)
    names = {topic["name"].casefold() for topic in topics}
    previous = {_key(a): a for a in existing if a.get("generatedBy") in GENERATED_KINDS}
    manual = [copy.deepcopy(a) for a in existing if a.get("generatedBy") not in GENERATED_KINDS]
    completed = [copy.deepcopy(a) for a in existing if a.get("generatedBy") in GENERATED_KINDS and a.get("completed") and (
        a.get("topic", "").casefold() in names or
        (a.get("generatedBy") == "final-review" and set(a.get("topicNames", [])) == {t["name"] for t in topics})
    )]
    result = manual + completed
    used = defaultdict(int)
    for activity in result:
        used[activity["studyDate"]] += activity["estimatedMinutes"]
    if any(used[day] > daily_minutes for day in study_days):
        raise ValueError("Existing activities exceed the daily study time. Increase the available time before generating a plan.")

    completed_methods = defaultdict(set)
    for activity in completed:
        if activity.get("generatedBy") == "day-plan":
            completed_methods[activity["topic"].casefold()].add(activity["studyMethod"])
    pending = []
    for topic in topics:
        done = completed_methods[topic["name"].casefold()]
        old_methods = list(dict.fromkeys(a.get("studyMethod") for a in existing if a.get("generatedBy") == "day-plan" and a.get("topic", "").casefold() == topic["name"].casefold()))
        methods = [m for m in old_methods if m not in done] if done else []
        if done and not methods:
            topic["scheduledDate"] = max(a["studyDate"] for a in completed if a.get("generatedBy") == "day-plan" and a["topic"].casefold() == topic["name"].casefold())
        else:
            pending.append((topic, methods))

    final_day = study_days[-1]
    reserve_final = len(study_days) > 1 and daily_minutes - used[final_day] >= 5
    learning_days = study_days[:-1] if reserve_final else study_days
    minimum = sum(5 * max(1, len(methods)) for _, methods in pending)
    if sum(max(0, daily_minutes - used[day]) for day in learning_days) < minimum:
        learning_days = study_days
        reserve_final = False
    allocations = defaultdict(list)
    desired = distribute_topics_across_study_days([t for t, _ in pending], learning_days)
    for (topic, methods), target in zip(pending, desired):
        required = 5 * max(1, len(methods))
        target_index = learning_days.index(target["scheduledDate"])
        candidates = sorted(learning_days, key=lambda day: (abs(learning_days.index(day) - target_index), day))
        chosen = next((day for day in candidates if daily_minutes - used[day] - sum(5 * max(1, len(m)) for _, m in allocations[day]) >= required), None)
        if chosen is None:
            raise ValueError("There is not enough daily study time for all selected topics. Increase the time or reduce the selected topics.")
        topic["scheduledDate"] = chosen
        allocations[chosen].append((topic, methods))

    warnings = []
    if not reserve_final:
        warnings.append("A separate final review day could not be reserved. More study days or time are needed.")

    def add(activity):
        prior = previous.get(_key(activity), {})
        if prior.get("completed") and any(a.get("id") == prior.get("id") for a in completed):
            return
        identity = ":".join(str(value) for value in _key(activity))
        activity["id"] = prior.get("id") or str(uuid.uuid5(uuid.NAMESPACE_URL, f"exam-activity:{plan_id}:{identity}"))
        activity["completed"] = False
        if prior.get("createdAt"):
            activity["createdAt"] = prior["createdAt"]
        result.append(activity)
        used[activity["studyDate"]] += activity["estimatedMinutes"]

    flagged = {name.casefold() for name in flagged_topics}
    review_days = study_days[:-1] if reserve_final else study_days
    for topic in sorted(topics, key=lambda t: (t["name"].casefold() not in flagged, t["scheduledDate"])):
        later = [day for day in review_days if day > topic["scheduledDate"]]
        for round_index, offset in enumerate((0, 2, 6), 1):
            candidates = later[offset:]
            selected = None
            for day in candidates:
                reserved_learning = sum(5 * max(1, len(m)) for _, m in allocations[day])
                capacity = daily_minutes - used[day] - reserved_learning
                # Keep most of a learning day available for its new material.
                review_limit = max(5, daily_minutes // 3) if allocations[day] else daily_minutes
                already_review = sum(a["estimatedMinutes"] for a in result if a.get("generatedBy") == "automatic-review" and a["studyDate"] == day)
                if capacity >= 5 and already_review + 5 <= review_limit and not any(a.get("generatedBy") == "automatic-review" and a["topic"] == topic["name"] and a["studyDate"] == day for a in result):
                    selected = (day, min(10, capacity, review_limit - already_review))
                    break
            if selected is None:
                if round_index == 1 and later:
                    warnings.append(f"No later review slot was available for {topic['name']} before final review.")
                continue
            day, minutes = selected
            method = "flashcards" if assign_study_method(topic) == "flashcards" else ("voice_memo" if round_index % 2 else "practice_quiz")
            add({"topic": topic["name"], "studyDate": day, "estimatedMinutes": minutes, "studyMethod": method, "activityType": "review", "generatedBy": "automatic-review", "reviewRound": round_index, "instruction": f"Recall earlier material from memory: {topic['name']}"})

    for day, day_topics in allocations.items():
        if not day_topics:
            continue
        budget = daily_minutes - used[day]
        minimums = [5 * max(1, len(methods)) for _, methods in day_topics]
        extra, remainder = divmod(budget - sum(minimums), len(day_topics))
        for index, (topic, methods) in enumerate(day_topics):
            minutes = minimums[index] + extra + (index < remainder)
            steps = build_topic_study_steps(topic, minutes)
            if methods:
                per_step, extra_step = divmod(minutes, len(methods))
                steps = [{"studyMethod": method, "estimatedMinutes": per_step + (i < extra_step), "stepOrder": i, "instruction": f"Continue {method.replace('_', ' ')}: {topic['name']}"} for i, method in enumerate(methods)]
            for step in steps:
                add({"topic": topic["name"], "studyDate": day, "generatedBy": "day-plan", "activityType": step["studyMethod"], **step})

    if reserve_final:
        capacity = daily_minutes - used[final_day]
        ordered_names = [t["name"] for t in sorted(topics, key=lambda t: t["name"].casefold() not in flagged)]
        methods = ["reading_review", "practice_quiz"] if capacity >= 10 else ["practice_quiz"]
        if capacity >= 5:
            per_step, extra = divmod(capacity, len(methods))
            for index, method in enumerate(methods):
                add({"topic": "Final exam review", "topicNames": ordered_names, "studyDate": final_day, "estimatedMinutes": per_step + (index < extra), "studyMethod": method, "activityType": "review", "generatedBy": "final-review", "stepOrder": index, "instruction": ("Review key concepts and flagged topics" if method == "reading_review" else "Take a mixed practice quiz on previously studied topics")})

    kind_order = {"day-plan": 0, "automatic-review": 1, "final-review": 2}
    result.sort(key=lambda a: (a["studyDate"], kind_order.get(a.get("generatedBy"), 0), a.get("topic", ""), a.get("stepOrder", 0)))
    return topics, result, {"version": 2, "finalReviewDate": final_day if reserve_final else None, "warnings": list(dict.fromkeys(warnings))}


def reschedule_missed_day(activities, missed_date, remaining_days, daily_minutes):
    remaining_days = sorted(set(day for day in remaining_days if day > missed_date))
    if not remaining_days:
        raise ValueError("No available study days remain before the exam.")
    fixed = [copy.deepcopy(a) for a in activities if a.get("completed")]
    pending = [copy.deepcopy(a) for a in activities if not a.get("completed")]
    if not any(a["studyDate"] <= missed_date for a in pending):
        raise ValueError("There are no unfinished activities on or before that day.")
    used = defaultdict(int)
    learned = {}
    for activity in fixed:
        used[activity["studyDate"]] += activity["estimatedMinutes"]
        if activity.get("generatedBy") == "day-plan":
            learned[activity["topic"]] = max(learned.get(activity["topic"], ""), activity["studyDate"])
    order = {"day-plan": 0, "automatic-review": 1, "topic-review": 1, "final-review": 2}
    pending.sort(key=lambda a: (order.get(a.get("generatedBy"), 0), a["studyDate"], a.get("stepOrder", 0)))
    has_final = any(a.get("generatedBy") == "final-review" for a in activities)
    for activity in pending:
        kind = activity.get("generatedBy")
        days = remaining_days
        if has_final:
            days = remaining_days[-1:] if kind == "final-review" else remaining_days[:-1]
        if kind in {"automatic-review", "topic-review"}:
            days = [day for day in days if day > learned.get(activity["topic"], "")]
        if kind in {"automatic-review", "topic-review"}:
            days = [day for day in days if not any(a.get("generatedBy") in {"automatic-review", "topic-review"} and a["topic"] == activity["topic"] and a["studyDate"] == day for a in fixed)]
        chosen = next((day for day in days if used[day] + 5 <= daily_minutes), None)
        if chosen is None:
            raise ValueError("The remaining work cannot fit before the exam within your daily time limit. Increase the study time or reduce the remaining activities.")
        activity["rescheduledFrom"] = activity.get("rescheduledFrom", activity["studyDate"])
        activity["previousEstimatedMinutes"] = activity.get("previousEstimatedMinutes", activity["estimatedMinutes"])
        activity["estimatedMinutes"] = 5
        activity["studyDate"] = chosen
        used[chosen] += activity["estimatedMinutes"]
        if kind == "day-plan":
            learned[activity["topic"]] = max(learned.get(activity["topic"], ""), chosen)
        fixed.append(activity)
    # Expand the minimum viable sessions only after every remaining task has a slot.
    for day in remaining_days:
        available = max(0, daily_minutes - used[day])
        day_tasks = [a for a in fixed if not a.get("completed") and a["studyDate"] == day]
        for activity in day_tasks:
            desired = max(0, activity["previousEstimatedMinutes"] - activity["estimatedMinutes"])
            extra = min(available, desired)
            activity["estimatedMinutes"] += extra
            available -= extra
    return sorted(fixed, key=lambda a: (a["studyDate"], order.get(a.get("generatedBy"), 0), a.get("stepOrder", 0)))
