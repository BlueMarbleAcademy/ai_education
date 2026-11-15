# Blue Marble Academy – AI Education Platform

A study platform that uses AI to help students learn. Users can generate and study flashcards, take AI-generated practice tests, build mind maps, record voice notes, summarize documents, and build exam study plans from their own course materials.

- **Frontend:** React 18 + Vite + Tailwind CSS (this folder)
- **Backend:** FastAPI (Python) in [backend/](backend/)
- **Auth:** Azure AD B2C via MSAL (guest mode is also available)
- **Storage:** Azure Cosmos DB, with a local JSON fallback for development
- **AI:** OpenAI / Azure OpenAI

## Features

| Area | Route | Description |
| --- | --- | --- |
| Dashboard | `/dashboard` | Recents and study stats |
| Flashcards | `/tools/flashcards` | AI-generated decks, study mode, pre-generated sample decks |
| Practice Tests | `/tools/practice-tests` | AI quiz wizard, saved quizzes, attempt history, performance summary, PDF export |
| Mind Maps | `/tools/mind-maps` | Interactive mind maps (ReactFlow) with image export |
| Voice Notes | `/tools/voice-notes` | Record notes (audio stored in Azure Blob Storage) |
| Summarizer | `/tools/summarizer` | Summarize uploaded documents |
| Study Planner | `/tools/study-planner` | Exam-date based plans built from uploaded materials, linked to flashcards, mind maps, voice memos and quizzes, with progress tracking and missed-day rescheduling |
| Workspace | `/workspace` | Folders, unfiled items, trash |
| Public Library / Sharing | `/public_library`, `/share/:token` | Browse and share items via link |

## Project Structure

This folder is the repository root of the app (the frontend lives here, not in `src/` alone).

```
project/
├── backend/                 # FastAPI API
│   ├── main.py              # App entry point and routes
│   ├── database.py          # Cosmos DB client
│   ├── openai_client.py     # OpenAI / Azure OpenAI calls
│   ├── pdf_utils.py         # Document text extraction
│   ├── study_plan_*.py      # Study planner logic (dates, scheduling, materials, exams)
│   ├── models.py
│   ├── requirements.txt
│   ├── .env.example         # Copy to .env
│   └── run.sh
├── src/
│   ├── pages/               # Route pages (tools/, shared/, workspace, dashboard…)
│   ├── components/          # Shared UI components
│   ├── hooks/               # Auth token, profile, stats, recents hooks
│   ├── context/             # Guest mode context
│   ├── authConfig.js        # MSAL / Azure B2C config
│   └── config.js            # API endpoints
├── sample_flashcards/       # Sample flashcard decks (JSON)
├── sample_quizzes/          # Sample quizzes by grade (JSON)
├── tests/                   # Node test runner tests
├── _localdb/                # Local JSON store (dev mode)
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (with npm)
- [Python](https://www.python.org/) 3.10+
- Git
- Credentials for the services you want to use (ask a team member; see [Configuration](#configuration)). **Never commit secrets.**

## Getting Started

You need two terminals: one for the backend, one for the frontend.

### 1. Clone the repository

```bash
git clone https://github.com/BlueMarbleAcademy/ai_education.git
cd ai_education/project
```

If your clone has the app at a different depth, `cd` into the folder that contains `package.json` and `backend/`.

### 2. Configure and start the backend

```powershell
cd backend
python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1
# macOS / Linux
# source venv/bin/activate

pip install -r requirements.txt

# Create your env file, then fill in the values
copy .env.example .env      # macOS/Linux: cp .env.example .env

uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

On macOS/Linux you can instead run `./run.sh` (activates `venv` if present and starts uvicorn).

### 3. Start the frontend

In a second terminal, from the project root (the folder with `package.json`):

```bash
npm install
npm run dev
```

Open http://localhost:5173 (Vite's default port; the terminal prints the exact URL).

> The backend allows the origin `http://localhost:5173` by default (`FRONTEND_ORIGINS`). If Vite starts on a different port, add that origin to `FRONTEND_ORIGINS` in `backend/.env` and restart the backend.

## Configuration

### Backend (`backend/.env`)

Copy [backend/.env.example](backend/.env.example) to `backend/.env`. Key variables:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI key for AI features and study-plan material analysis |
| `AZURE_OPENAI_QUIZ_GENERATOR_*`, and the other Azure OpenAI deployment settings used in `main.py` | Azure OpenAI endpoint, key and deployment names for quiz/flashcard/summarizer generation (`/health` reports which are set) |
| `COSMOS_DB_URL`, `COSMOS_DB_KEY` | Cosmos DB (database `ai-education-platform-db`, container `userContent`) |
| `CLIENT_ID`, `CLIENT_SECRET`, `AUTHORITY` | Azure AD token validation |
| `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_BLOB_*` | Blob storage for voice notes |
| `FRONTEND_ORIGINS` | Comma-separated allowed CORS origins (default `http://localhost:5173`) |
| `USE_LOCAL_JSON_STORE` | Set to `true` to store data in `backend/_localdb` instead of Cosmos DB |
| `COSMOS_FALLBACK_TO_LOCAL` | `1` (default) falls back to local JSON if Cosmos is unreachable; `0` to fail fast |

**Running without Cosmos DB:** set `USE_LOCAL_JSON_STORE=true`. AI features still require valid OpenAI / Azure OpenAI keys.

### Frontend

- `VITE_API_BASE_URL` (optional) – backend URL used by most hooks; defaults to `http://localhost:8000`. Set it in a `.env.local` file at the project root to override.
- [src/config.js](src/config.js) and [src/authConfig.js](src/authConfig.js) hard-code the backend URL (`http://127.0.0.1:8000`) and the Azure B2C tenant/client IDs. Edit these if you point at a different backend or tenant.
- Sign-in uses Azure AD B2C. If you don't have access to the tenant, use the guest option on the sign-in page.

### Getting credentials

Azure keys and database details are shared by the team through the Azure portal or a team member. Do not store credentials in this README or commit them to git.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests (`node --test`) |

## Study Planner Notes

See [backend/README.md](backend/README.md) for details. In short:

- Uploads accept PDF, DOCX, TXT, PPTX, PNG, JPG and JPEG files up to 20 MB each.
- Scans and diagrams are read with the OpenAI key (image-reading usage applies; no Azure OCR account needed).
- Confirming topics creates review activities and reserves the last pre-exam day for final review.
- The missed-day control moves unfinished work to available days and preserves completed work.

## Troubleshooting

- **`Activate.ps1 cannot be loaded` on Windows:** run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, then activate again.
- **CORS errors in the browser:** make sure the frontend origin is listed in `FRONTEND_ORIGINS` and restart the backend.
- **Frontend can't reach the API:** confirm the backend is running on port 8000 and check `/health`.
- **AI features fail:** check `/health` to see which environment variables are missing.
- **Port already in use:** change the uvicorn `--port` (and update `VITE_API_BASE_URL`, `src/config.js` and `src/authConfig.js`) or stop the other process.

## Contributing

1. Create a feature branch from `main`.
2. Make your changes; run `npm run lint` and `npm test`.
3. Open a pull request describing the change.

## License

No license has been specified yet.
