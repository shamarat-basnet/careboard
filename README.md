# CareBoard

Patient management dashboard. React + TypeScript frontend, FastAPI backend, PostgreSQL.

Features: patient CRUD with search, filters, sorting and pagination, clinical notes, generated patient summaries, login, dark mode.

## Run it

```bash
docker compose up --build
```

Open http://localhost:3000 and sign in with `admin@example.com` / `ChangeMe-Demo-2026`. That password is for local demos only. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` (copy `.env.example`) to change it.

On start the backend runs migrations and loads 150 sample patients if the database is empty. `docker compose down -v` resets everything.

| What     | Where                                  |
| -------- | -------------------------------------- |
| App      | http://localhost:3000                  |
| API docs | http://localhost:8000/docs             |
| Postgres | `localhost:5432` (postgres / postgres) |

Hot reload: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`, then open http://localhost:5173.

### Without Docker

Needs Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node 20+, and Postgres.

```bash
docker compose up -d db          # or use your own Postgres

cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m app.seed.admin
uv run python -m app.seed
uv run uvicorn app.main:app --reload

cd frontend                      # in a second terminal
npm install
npm run dev
```

## Tests

```bash
cd backend && uv run pytest && uv run ruff check .
cd frontend && npm test && npm run lint && npm run typecheck
```

Backend tests use SQLite by default. Set `TEST_DATABASE_URL` to run them on Postgres.

## API

Everything except `/health` and `/auth/login` needs a session. Errors always look like this:

```json
{
  "error": {
    "code": "validation_error",
    "message": "...",
    "fields": [{ "field": "email", "message": "..." }]
  }
}
```

| Endpoint                                                | Notes                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Session cookie                                                                 |
| `GET /health`                                           | `{"status": "ok"}`                                                             |
| `GET /patients`                                         | `page`, `page_size`, `search`, `status`, `blood_type`, `sort_by`, `sort_order` |
| `GET /patients/stats`                                   | Counts for the dashboard                                                       |
| `GET /patients/{id}`                                    | 404 if missing                                                                 |
| `POST /patients`                                        | 201, or 422 with per-field errors                                              |
| `PUT /patients/{id}`                                    | Send the `updated_at` you loaded. 409 if someone else saved first              |
| `DELETE /patients/{id}`                                 | 204. Deletes the patient's notes too                                           |
| `GET /patients/{id}/notes`                              | Newest first                                                                   |
| `POST /patients/{id}/notes`                             | `{content, timestamp?}`                                                        |
| `DELETE /patients/{id}/notes/{note_id}`                 |                                                                                |
| `GET /patients/{id}/summary`                            | Profile facts plus a narrative built from the notes                            |

## How it works

- **Login:** random session token in an `httpOnly`, `SameSite=Strict` cookie. Only its hash is stored, so logging out revokes it immediately. Passwords use scrypt. Five wrong attempts lock the account for 15 minutes. Set `COOKIE_SECURE=true` behind HTTPS. No password reset, roles or MFA yet.
- **Summaries:** names, conditions and allergies come straight from the database. Only the narrative is generated. By default it uses a template. With `SUMMARY_PROVIDER=llm` and `ANTHROPIC_API_KEY` it asks Claude, without sending the patient's name, and falls back to the template on any failure.
- **Search and lists:** filtering, sorting and paging happen on the server, with trigram indexes on name and email. List state lives in the URL, so views can be shared. Typing is debounced.
- **Forms:** zod rules mirror the backend rules. Server errors show on the matching field.
- **Schema:** Alembic migrations. CI checks they match the models.

```
backend/app    api/routes, services, schemas, models, core, seed
backend/alembic
frontend/src   api, features, components, app
api/index.py   Vercel entrypoint
```

## Branches and deploys

`develop` → `preview` → `release`, merged by pull request. Pull requests run the tests. A push to any of the three runs the tests, migrates that branch's database, and deploys to Vercel: `release` to production, the others to preview URLs.

The app and API are one Vercel project. The frontend is static and `api/index.py` serves FastAPI under `/api`.

Setup, once:

1. Create three Postgres databases (Neon works). Don't share the `release` one.
2. Create one Vercel project from this repo, preset "Other", repo root as the root directory.
3. In GitHub, create environments `develop`, `preview` and `release`. Add a required reviewer to `release`.
4. Add repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
5. Add secrets to each environment: `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters). `ANTHROPIC_API_KEY` is optional.
6. Add the repository variable `DEPLOY_ENABLED=true`. Until then pushes only run tests.

Optional variables per environment: `SEED_DEMO_DATA=true` (skip it for `release`), `SUMMARY_PROVIDER=llm`, `VERCEL_ALIAS` for a fixed address.

`requirements.txt` is generated for Vercel: `cd backend && uv export --no-dev --no-hashes --frozen --no-emit-project -o ../requirements.txt`. CI fails if it falls behind `uv.lock`.
