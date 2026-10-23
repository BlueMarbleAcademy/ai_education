import pytest

from study_plan_scheduling import (
    distribute_topics_across_study_days,
    verify_topics_scheduled_before_exam,
)


def test_distributes_topics_evenly_when_topics_outnumber_days():
    topics = [{"name": f"Topic {index}"} for index in range(1, 8)]
    study_days = ["2026-10-22", "2026-10-23", "2026-10-24"]

    scheduled_topics = distribute_topics_across_study_days(topics, study_days)
    counts = [
        sum(topic["scheduledDate"] == day for topic in scheduled_topics)
        for day in study_days
    ]

    assert counts == [3, 2, 2]
    assert all("scheduledDate" not in topic for topic in topics)


def test_spreads_topics_across_remaining_days_when_days_outnumber_topics():
    topics = [{"name": "First"}, {"name": "Second"}]
    study_days = ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]

    scheduled_topics = distribute_topics_across_study_days(topics, study_days)

    assert [topic["scheduledDate"] for topic in scheduled_topics] == [
        "2026-10-22",
        "2026-10-25",
    ]


def test_leaves_topics_unscheduled_when_no_days_remain():
    topics = [{"name": "First"}]

    assert distribute_topics_across_study_days(topics, []) == [
        {"name": "First", "scheduledDate": None}
    ]


def test_verifies_every_topic_is_scheduled_before_the_exam():
    topics = [
        {"name": "First", "scheduledDate": "2026-10-22"},
        {"name": "Second", "scheduledDate": "2026-10-23"},
    ]

    verify_topics_scheduled_before_exam(topics, "2026-10-24")


@pytest.mark.parametrize(
    "scheduled_date",
    [None, "2026-10-24", "2026-10-25", "invalid"],
)
def test_rejects_topics_not_scheduled_before_the_exam(scheduled_date):
    topics = [{"name": "Major topic", "scheduledDate": scheduled_date}]

    with pytest.raises(ValueError, match="scheduled before the exam"):
        verify_topics_scheduled_before_exam(topics, "2026-10-24")


def test_rejects_an_invalid_exam_date():
    with pytest.raises(ValueError, match="Exam date must be a valid date"):
        verify_topics_scheduled_before_exam(
            [{"name": "Major topic", "scheduledDate": "2026-10-22"}],
            "invalid",
        )
