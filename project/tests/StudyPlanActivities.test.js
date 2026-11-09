import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server.js";
import { createServer } from "vite";

let vite;
let StudyPlanActivities;

before(async () => {
  vite = await createServer({
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true },
  });
  ({ default: StudyPlanActivities } = await vite.ssrLoadModule(
    "/src/pages/tools/studyPlans/StudyPlanActivities.jsx"
  ));
});

after(async () => {
  if (vite) {
    await vite.close();
  }
});

test("renders checklist activities in separate chronological study-date groups", async () => {
  const plan = {
    id: "plan-1",
    studyStartDate: "2026-11-08",
    examDate: "2026-11-20",
    activities: [
      {
        id: "activity-later",
        topic: "Practice derivatives",
        activityType: "practice_quiz",
        estimatedMinutes: 45,
        studyDate: "2026-11-12",
        completed: true,
      },
      {
        id: "activity-first",
        topic: "Review limits",
        activityType: "reading",
        estimatedMinutes: 30,
        studyDate: "2026-11-10",
        completed: false,
      },
      {
        id: "activity-same-day",
        topic: "Make limit flashcards",
        activityType: "flashcards",
        estimatedMinutes: 20,
        studyDate: "2026-11-10",
        completed: true,
      },
    ],
  };
  const markup = renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      null,
      React.createElement(StudyPlanActivities, {
        plan,
        onAddActivity: async () => {},
        onToggleActivity: () => {},
      })
    )
  );

  const groups = [
    ...markup.matchAll(
      /<section aria-labelledby="study-date-(\d{4}-\d{2}-\d{2})">([\s\S]*?)<\/section>/g
    ),
  ];

  assert.deepEqual(
    groups.map(([, date]) => date),
    ["2026-11-10", "2026-11-12"]
  );
  assert.equal((markup.match(/<ol class="divide-y/g) || []).length, 2);

  const firstDayMarkup = groups[0][2];
  assert.match(firstDayMarkup, /Review limits/);
  assert.match(firstDayMarkup, /Make limit flashcards/);
  assert.match(firstDayMarkup, /aria-label="Mark complete: Review limits" aria-pressed="false"/);
  assert.match(firstDayMarkup, /aria-label="Mark incomplete: Make limit flashcards" aria-pressed="true"/);
  assert.doesNotMatch(firstDayMarkup, /Practice derivatives/);
  assert.match(groups[1][2], /Practice derivatives/);
  assert.match(groups[1][2], />Practice quiz<\/button>/);
});
