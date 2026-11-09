# CareBoard: Healthcare Patient Dashboard

A full-stack patient management dashboard: **React + TypeScript** (Vite, Mantine, TanStack Query), **FastAPI**, and **PostgreSQL**. It covers patient CRUD, search, filtering, sorting and pagination, clinical notes, generated patient summaries, and validated forms. Everything is containerized.

## Quick start (Docker)

```bash
cp .env.example .env          # optional: every value has a default
docker compose up --build
```

Then open http://localhost:3000 and sign in with the demo account **`admin@example.com` / `ChangeMe-Demo-2026`**. These defaults are for local demos only. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before exposing the app anywhere (the first account is created at start-up, only if no users exist yet).

| Service    | URL                                                                 |
| ---------- | ------------------------------------------------------------------- |
| Frontend   | http://localhost:3000                                               |
| API        | http://localhost:8000 (also proxied at `localhost:3000/api`)        |
| API docs   | http://localhost:8000/docs                                          |
| PostgreSQL | `localhost:5432` (postgres / postgres; published on localhost only) |

When the backend starts, it applies migrations (`alembic upgrade head`) and seeds **150 patients** (20 hand-written with clinical notes, plus generated ones). Seeding runs only if the table is empty, so restarts are safe. To reset all data, run `docker compose down -v`.

**Hot reload in Docker:** run `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` and open http://localhost:5173. The backend source is mounted and uvicorn uses `--reload`. The frontend runs on the Vite dev server with HMR.

## Running without Docker

Requirements: Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node 20+, and a PostgreSQL 16 instance.

```bash
# Database only
docker compose up -d db

# Backend: http://localhost:8000
cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload

# Frontend: http://localhost:5173 (proxies /api to :8000)
cd frontend
npm install
npm run dev
```

## Tests and quality checks

```bash
# Backend: 68 tests; in-memory SQLite by default, real Postgres if TEST_DATABASE_URL is set
cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .

# Frontend: Vitest + Testing Library
cd frontend && npm test && npm run lint && npm run typecheck && npm run format:check
```

On every push, CI (`.github/workflows/ci.yml`) runs:

- the backend suite against Postgres, plus `alembic check` to catch drift between the models and the migrations
- the frontend checks and a production build
- a smoke test of the full `docker compose` stack through the nginx proxy

## Authentication

Every `/patients` route needs a signed-in user. Only `/health` and `/auth/login` are open.

- **Server-side sessions.** `POST /auth/login` creates a session row and sets an `httpOnly`, `SameSite=Strict` cookie holding a random token. Only the token's SHA-256 hash is stored, so a database leak yields no usable sessions, and `POST /auth/logout` revokes the session immediately. Sessions expire after 12 hours (`SESSION_TTL_HOURS`).
- **Passwords** are hashed with scrypt from the standard library (random salt, constant-time comparison), with a 12-character minimum.
- **Brute-force protection** is stored in the database, so it holds across worker processes: 5 failed attempts lock the account for 15 minutes (`429`). The same message is returned for a wrong password and an unknown email, and both take the same time to check, so attackers can't discover which emails exist.
- **CSRF:** the `SameSite=Strict` cookie is never sent on cross-site requests, and the API only accepts JSON.
- **In the browser,** a 401 from any request sends you to the login page. Signing out (or in) clears all cached patient data, and the frontend nginx serves security headers (CSP, `nosniff`, no framing) as a non-root user.
- Set `COOKIE_SECURE=true` when serving over HTTPS. Not included: password reset, roles, MFA, and an audit log.

## API

All errors use a single envelope so clients handle them in one place:

```json
{
  "error": {
    "code": "validation_error",
    "message": "...",
    "fields": [{ "field": "email", "message": "..." }]
  }
}
```

| Method & path                                           | Notes                                                                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Sign in/out; who am I. Everything below needs a session                                                                                                      |
| `GET /health`                                           | `{"status": "ok"}`                                                                                                                                           |
| `GET /patients`                                         | `page`, `page_size` (≤100), `search`, `status` (repeatable), `blood_type`, `sort_by` (`name`/`age`/`last_visit`/`status`/`created_at`), `sort_order`         |
| `GET /patients/stats`                                   | Counts by status and visits in the last 30 days (powers the dashboard)                                                                                       |
| `GET /patients/{id}`                                    | 404 if missing, 422 if the id isn't a UUID                                                                                                                   |
| `POST /patients`                                        | 201 + `Location` header; 422 with per-field errors                                                                                                           |
| `PUT /patients/{id}`                                    | Full replacement. Body must include the `updated_at` you loaded; if the record changed since, it returns **409** instead of overwriting (optimistic locking) |
| `DELETE /patients/{id}`                                 | 204; the patient's notes are deleted with it (`ON DELETE CASCADE`)                                                                                           |
| `GET /patients/{id}/notes`                              | Newest first                                                                                                                                                 |
| `POST /patients/{id}/notes`                             | `{content, timestamp?}`; timestamp defaults to now and can't be in the future                                                                                |
| `DELETE /patients/{id}/notes/{note_id}`                 | 404 if the note belongs to a different patient                                                                                                               |
| `GET /patients/{id}/summary`                            | Identifiers, conditions, allergies, and a narrative built from the notes                                                                                     |

Each request is logged with method, path, status, latency, and an `X-Request-ID`. The ID is generated, or taken from the incoming header, and returned in the response.

## Architecture and key decisions

```
backend/app
  api/routes/     HTTP layer: thin handlers, request/response models only
  services/       business logic (queries, summary generation); no FastAPI imports
  schemas/        Pydantic models: validation and normalization
  models/         SQLAlchemy 2.0 ORM models
  core/           settings, error envelope, request-logging middleware
  seed/           deterministic sample data
backend/alembic   migrations (source of truth for the schema)

frontend/src
  api/            typed fetch client (ApiError / NetworkError) + endpoint functions
  features/       feature folders: dashboard, patients (pages, components, queries, schema)
  components/     app shell, error boundary, shared UI
  app/            providers, router, theme, query client
```

**Backend**

- **Sync SQLAlchemy 2.0 with psycopg 3.** FastAPI runs sync handlers in a threadpool, which is plenty for this workload and keeps the code and tests simple. Moving to `AsyncSession` later would be mechanical, because the routes don't touch the ORM directly.
- **Alembic owns the schema.** The initial migration also adds a `pg_trgm` GIN index, so `%term%` search on name and on email uses an index instead of scanning the table (at 150 rows Postgres will still pick a scan; the indexes matter at scale), plus B-tree indexes for the sort columns.
- **Validation is in Pydantic, not the database.** Names, emails, and phones are trimmed and checked. Blank optional strings become `null`. Allergy and condition lists are de-duplicated case-insensitively. Dates can't be in the future, and a last visit can't be earlier than the date of birth. Request bodies reject unknown fields (`extra="forbid"`).
- **Offset pagination with a unique tiebreaker** (`ORDER BY …, id`) so pages are stable. At ~10⁵+ rows I'd switch to keyset (cursor) pagination.
- **Summaries:** the patient's name is never sent to the LLM, and the page only regenerates the summary when a note or the profile changes. Identifiers, conditions, and allergies always come straight from the database, so they can't be hallucinated. Only the narrative is pluggable:
  - `TemplateNarrator` (default): deterministic and offline. It reads the notes chronologically and takes the first sentence of the five most recent.
  - `ClaudeNarrator`: set `SUMMARY_PROVIDER=llm` and `ANTHROPIC_API_KEY`. It uses a short timeout and enables the API's server-side refusal fallback. On any failure (API error, refusal, empty output) it falls back to the template, so the endpoint never breaks because of the LLM. The response's `source` field reports which narrator wrote the text.

**Frontend**

- **Mantine** for components (accessible, responsive props such as `visibleFrom`/`hiddenFrom`, built-in dark mode) with **no separate styling system**: theme tokens plus a tiny global stylesheet.
- **State:** server state lives in **TanStack Query** with hierarchical query keys for targeted invalidation, and the delete-note action updates the UI optimistically with rollback. **List state (page, search, filters, sort) lives in the URL**, so views are shareable and work with back/forward. Nothing needed a global client-state store.
- **Non-blocking search and large lists:** the input is local state and only reaches the URL/query after a 300 ms debounce. `keepPreviousData` keeps the current page visible (dimmed) while the next one loads. Filtering, sorting, and paging all happen on the server, so 150 or 150,000 patients cost the browser the same. Rows are memoized, and hovering a row prefetches the patient detail.
- **Forms:** react-hook-form and zod schemas mirror the backend rules for instant feedback. Server 422 errors are mapped back onto the matching fields. Network failures show a banner and keep the user's input.
- **Code splitting:** each route is lazy-loaded, and vendor libraries sit in long-cacheable chunks. App code is about 5 KB gzipped on first load.
- **One navigation, responsive:** a single sidebar on desktop (with a live critical-patient count, the account menu and theme switch), the same content in a drawer below 992 px, and no top bar on desktop. The patient list is a table on tablets and larger and cards on phones, and the filter chips scroll sideways instead of wrapping. Each page has one `h1`, a page title, and one primary action. There's a skip link, labelled controls, and the dashboard cards link through to filtered lists.

**Stretch goals implemented:** Alembic migrations, sort/filter query parameters, request-logging middleware, API and component tests, code splitting/lazy loading and memoization, dark/light theme, login with sessions, a dashboard with clickable stats, status filter chips with counts, `/` to search, an unsaved-changes warning on forms, CI, and hot reload in Docker.

## Branches and deploying to Vercel

| Branch    | Deploys to                | Use it for                                     |
| --------- | ------------------------- | ---------------------------------------------- |
| `develop` | Vercel **preview** deploy | day-to-day work; every push is deployed        |
| `preview` | Vercel **preview** deploy | a stable staging copy to review before release |
| `release` | Vercel **production**     | what users see; promote here when approved     |

Work flows `develop` → `preview` → `release` by pull request. Pull requests run the checks; **pushes** to these three branches run the checks and then deploy (`.github/workflows/ci.yml`). A deploy first runs `alembic upgrade head` against that stage's own database, makes sure the first user exists, then builds and deploys to Vercel. The React app and the API are one Vercel project: the app is static, and `api/index.py` serves FastAPI under `/api` as a serverless function, so the browser stays on one origin and the `SameSite=Strict` session cookie keeps working.

**One-time setup**

1. **Databases:** create three Postgres databases (for example one Neon project with three branches or databases, using the pooled connection string). Keep `release` separate: it must never share data with the other two.
2. **Vercel:** create one project from this repo with Framework Preset **Other** and the repo root as the root directory (`vercel.json` supplies the build settings). Note the project id and your team/org id (Project → Settings).
3. **GitHub Environments:** in Settings → Environments create `develop`, `preview` and `release`. Add a required reviewer to `release` so production needs a click.
4. **Secrets:** repository-level `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. In **each environment**: `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 12 characters, and not the demo one). Optional: `ANTHROPIC_API_KEY`.
5. **Turn deploys on:** add the repository variable `DEPLOY_ENABLED` = `true` (Settings → Secrets and variables → Actions → Variables). Until then pushes only run the checks.
6. **Variables (optional, per environment):** `SEED_DEMO_DATA=true` to load the sample patients (leave it unset for `release`), `SUMMARY_PROVIDER=llm`, and `VERCEL_ALIAS` (for example `careboard-develop.vercel.app`) to give a stage a stable address.

`requirements.txt` at the repo root is generated for Vercel with `cd backend && uv export --no-dev --no-hashes --frozen --no-emit-project -o ../requirements.txt`; CI fails if it drifts from `uv.lock`.

## With more time

- Roles (clinician vs. front desk), password change/reset, MFA, and an audit log of who viewed or changed each record (needed for HIPAA)
- Generating the TypeScript API types from the OpenAPI schema (`openapi-typescript`) instead of hand-writing them
- Keyset pagination, and Playwright E2E tests for the main user journeys
- Soft deletes for patients, plus editing notes with version history
