# Handoff: Dashboard + Study Planner Calendar

Branch: `asu_teambranch`. Setup and env vars are in [README.md](README.md). This covers only the Dashboard and the Study Planner calendar page.

---

## 1. Dashboard (`src/pages/Dashboard.jsx`, route `/dashboard`)

Signed-in only. If MSAL has no accounts it redirects to `/signin`.

### Sections (top to bottom)
| Section | Data source | Notes |
| --- | --- | --- |
| Hero + streak pill | `getStudyStreak()` (`api/apiService.js`) | Falls back to a same-day cached streak if the call fails. Confetti and a count-up animation play when `consumeRecentStudyStreakUpdate()` says the streak just changed. |
| Daily study checklist | `getStudyPlans()`, then `getStudyPlan(id)` for each plan | Flattens every plan's activities and groups them by `studyDate`. Shows today and future days, plus past days that still have unfinished items. Checking one calls `updateStudyPlanActivity(planId, activityId, completed)`. |
| Jump back in | `useUserRecents()` (`GET /api/recents`) | Shows 4 items. Clicking one posts `/api/track-access`, then navigates by `contentType`. |
| Quizio | `GET /weak-areas`, `POST /generate-quiz-from-topic` | Lists weak topics by score (<60 Weak, 60-74 Improving, 75+ Strong). Clicking one generates a quiz and navigates to `/tools/practice-tests` with `state: { quiz, autoStart: true }`. |
| Suggested Next Steps | `getSuggestedNextSteps()` (`GET` at `main.py:1893`) | Cards are routed with `step.actionPath`. |

### Known issues / cleanup
- **Dead code:** `studyGoals`, `StudyGoalCard`, `AchievementCard` and `email` are unused. `tasks`, `loading` and `error` (from `getTasks`) feed only the error banner and the initial spinner, so the Tasks call is basically leftover.
- **N+1 fetch:** the checklist makes one request per study plan. A single backend endpoint that returns all activities would fix it.
- `handleQuizio` runs on mount before the account check, and `loadingTopic` is declared after its first use. It works, but it's messy.
- Quizio calls use `protectedResources.todoListApi.endpoint`, which is hard-coded to `http://127.0.0.1:8000` in `authConfig.js`. `RecentItemCard` uses `VITE_API_BASE_URL`. Pick one.
- There are `console.log` calls with account details at `Dashboard.jsx:239`. Remove them before release.
- The checklist is only as fresh as page load. Changes made in the planner show up after a reload or navigation.
- Duplicate files: `src/apiService.js` vs `src/api/apiService.js`, and `useUserProfile` / `useUserStats` exist as both `.js` and `.ts`. Confirm which are live and delete the others.

---

## 2. Study Planner calendar page (`/tools/study-planner`)

The calendar is the planner's home view. It's rendered by `renderPlannerHome()` inside `StudyPlans.jsx` (~1,575 lines, the main container).

### Files
| File | Job |
| --- | --- |
| `studyPlans/StudyPlans.jsx` | Container. Holds all state (plan, weekOffset, topic review, materials, missed-day). Renders the calendar, stats, materials and activities. |
| `studyPlans/studyPlanCalendar.js` | Pure helpers: `buildCalendarBlocks`, `getWeekActivities`, `getWeekOffsetForDate`, `getPlanFocusDate`, `formatPlannedTime`, and the activity colour/label maps. |
| `studyPlans/studyPlanDates.js` | `getAvailableStudyDays` (skips unavailable weekdays) and `formatDateValue`. |
| `studyPlans/studyPlanProgressMetrics.js` | `getStudyPlanProgress`. Caps at 99% until every activity is done. |
| `StudyPlanWizard.jsx` | Plan creation: exam, dates, unavailable days and materials. |
| `StudyPlanMaterials.jsx` | Upload and remove files (PDF, DOCX, TXT, PPTX, PNG, JPG; 20 MB max). |
| `StudyPlanActivities.jsx` | Checklist grouped by date. Add activity, toggle done, and launch buttons to Practice Quiz, Flashcards, Mind Map and Voice Memo. |
| `StudyPlanProgress.jsx` | Progress bar. |
| `StudyPlanSelector.jsx`, `SavedStudyPlansList.jsx` | Pick or manage saved plans. |
| `StudyPlanDisplay.jsx` | Older, text-style plan view (weeks/days/overview). It also has the quiz-linking UI. May be partly legacy. |

### How the calendar works
- Week view, Sunday to Saturday. `weekOffset` (0 = this week) is changed by the prev/next arrows. On plan load, on missed-day reschedule and when jumping to an activity, it's reset via `getWeekOffsetForDate(getPlanFocusDate(plan))`, which targets the next unfinished activity.
- Time grid is fixed at 8 AM to 6 PM (`CALENDAR_HOURS = 11`).
- **Blocks are not real clock times.** Activities have only a date and `estimatedMinutes`. `buildCalendarBlocks` stacks them top-down per day from 8 AM in sort order. Minimum visible height is 60 min, and blocks that overflow the grid are truncated.
- Sort order within a day: `stepOrder` (for `day-plan` items on the same topic), then `createdAt`, then topic.
- Block colour comes from `studyMethod || activityType`. Completed state is passed through.
- Header stats: this week's activities, completed count, planned minutes and completion %.

### Backend (`backend/main.py` + `study_plan_*.py`)
| Endpoint | Purpose |
| --- | --- |
| `POST /study-plans`, `GET /study-plans`, `GET/DELETE /study-plans/{id}` | CRUD |
| `POST /study-plans/materials`, `/study-plans/{id}/materials` (+ `DELETE`) | Upload and link files |
| `POST /study-plans/{id}/analyze-topics` | AI topic extraction from materials |
| `PUT /study-plans/{id}/topic-review`, `/confirmed-topics` | User review, then confirming creates the review activities and reserves the last pre-exam day for final review |
| `POST /study-plans/{id}/activities`, `PATCH .../activities/{aid}` | Add / toggle activity |
| `POST /study-plans/{id}/missed-day` | Reschedule unfinished work (min 5 min per activity, keeps completed work, rejects impossible moves atomically) |
| `GET /study-plans/{id}/voice-context` | Context for linked voice memos |

Scheduling logic lives in `study_plan_scheduling.py`, `study_plan_exam_schedule.py`, `study_plan_dates.py` and `study_plan_material_processing.py`.

### Recent work (git log)
Checklist by date, quiz / flashcard / mind-map / voice-memo links from activities, progress tracking, missed-day rescheduling, scan uploads, and final-review quiz topic fixes.

### Known issues / next steps
- No true time-of-day scheduling, so a user can't drag or place blocks. Adding `startTime` to activities would be needed first.
- `StudyPlans.jsx` is very large. Split `renderPlannerHome()` into components (calendar, week stats, topic review).
- Missed-day date picker is capped at today. It's only reachable from the calendar page, not the dashboard checklist.
- Dashboard "Open study planner" doesn't deep-link to a plan. Recent-item cards do (`?planId=`).
- Only one test file exists (`tests/StudyPlanActivities.test.js`). Calendar helpers are pure and easy to unit test (week boundaries, overflow truncation, sort order).
- Scans and diagrams use the OpenAI key (billable image reads). Files with over 40 visual pages/images are rejected.

---

## 3. Dead code affected by the new implementation

The new implementation is the real study-plan checklist on the Dashboard, plus the structured planner/calendar flow. These items are unused or superseded by it. Verified by grep that nothing else imports them.

### Safe to delete (Dashboard.jsx)
| Item | Why it's dead |
| --- | --- |
| `studyGoals` array (~L487-524) | Hard-coded mock goals (Biology, History, Calculus, Chemistry). Replaced by the real checklist. Never rendered. |
| `StudyGoalCard` component | Only renders `studyGoals`. Not used anywhere. |
| `AchievementCard` component | Not used anywhere. |
| `email` variable | Computed in render, never used. |
| `getTasks()` fetch + `tasks` state | Result is never displayed. Only `error` / `loading` are touched. Remove the effect, the states and the error banner, and drop the `loading && !userData` spinner or key it off `userData` alone. |
| Unused imports | `Star`, `Target` and `Play` from `lucide-react` are imported but never used. |

### Likely dead, confirm before deleting
| Item | Notes |
| --- | --- |
| `SavedStudyPlansList.jsx` | Not imported anywhere. `StudyPlanSelector` replaced it. |
| `StudyPlanDisplay.jsx` (legacy view) | `StudyPlans.jsx` only reaches it for saved plans with no structured data (the `else` at ~L182). New plans never go there. Check whether old-format plans still exist in Cosmos. If not, delete it along with `currentPlan`, the `showPlanner` branching, `updateStudyPlan()` and `POST /update-study-plan`. Note it holds the only quiz-linking UI. |
| `generateStudyPlan()` in `api/apiService.js` and `POST /generate-study-plan` | Not called from any component. Only referenced by `config.js` constants. This is the old one-shot AI plan generator, replaced by the analyze-topics / confirm-topics flow. |
| `GENERATE_STUDY_PLAN` / `UPDATE_STUDY_PLAN` in `config.js` | Go away with the two items above. |
| `POST /process-study-plan-material` and `/study-plan-materials` aliases | `main.py:3365-3367` stacks three routes on one handler. Frontend uses `/study-plans/materials`. Drop the other two if nothing external calls them. |
| Duplicate `src/apiService.js` and `.ts` hook twins | Listed in section 1. Confirm the live copies and remove the rest. |

### Not dead, don't touch
`StudyPlanActivities.jsx`, `StudyPlanProgress.jsx`, `studyPlanCalendar.js`, `studyPlanDates.js`, `studyPlanProgressMetrics.js` and the `/study-plans/*` endpoints. These are used by both the calendar and the Dashboard checklist.

---

## 4. Run / test
```bash
# backend (from backend/)
uvicorn main:app --reload --host 127.0.0.1 --port 8000
# frontend (from project root)
npm install && npm run dev      # http://localhost:5173
npm run lint && npm test
```
Set `USE_LOCAL_JSON_STORE=true` to run without Cosmos DB. AI features still need OpenAI keys. `/health` shows which env vars are missing.
