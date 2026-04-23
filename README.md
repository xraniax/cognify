# Cognify

## Quick Start

1. Clone the repository and enter it.
2. Copy environment templates exactly as shown:

```bash
#root 
cp .env.example .env
#backend 
cp backend/.env.example backend/.env
#engine
cp engine/.env.docker.example engine/.env.docker
```

3. Start the full stack:

```bash
docker-compose up --build
```

4. Open the app:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Engine API: http://localhost:8000

No manual setup steps are required after `docker-compose up --build`.

## Environment File Map

- `/.env`: shared orchestration values for Docker Compose (`POSTGRES_*`, `VITE_API_URL`).
- `/backend/.env`: backend runtime settings (DB, JWT, engine URL, upload path, optional OAuth/SMTP).
- `/engine/.env.docker`: engine + celery Docker runtime source of truth.
- `/engine/.env`: optional engine defaults for local non-Docker runs.
- `/engine/.env.local`: optional local override for direct script runs outside Docker.

Important: `engine/.env` and `engine/.env.local` are not required for Docker startup. They are only for local non-Docker engine execution.

## Required vs Optional

- Required (backend): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `ENGINE_URL`.
- Optional (backend): OAuth (`GOOGLE_*`, `GITHUB_*`), SMTP (`SMTP_*`, `EMAIL_FROM`), `SESSION_SECRET`, `BACKEND_URL`, `FRONTEND_URL`.
- Required (engine Docker): `DB_*`, `REDIS_URL`, `OLLAMA_BASE_URL`, `OLLAMA_GENERATION_MODEL`, `OLLAMA_EMBEDDING_MODEL`.
- Optional (engine): Google Drive upload integration (`GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`, `GOOGLE_SERVICE_ACCOUNT_FILE`, `GOOGLE_DRIVE_FOLDER_ID`).

## Google Drive Credentials (Secure Setup)

Primary method (recommended for production):

- Set `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` with a base64-encoded service account JSON payload.
- Set `GOOGLE_DRIVE_FOLDER_ID`.

Example conversion command:

```bash
base64 -i service-account.json
```

Then place the resulting string into `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`.

Development-only fallback:

- `GOOGLE_SERVICE_ACCOUNT_FILE` can point to a local JSON file path if base64 is not provided.
- This fallback is intended for local development only.

Security warning:

- Never commit `service-account.json` (or any credential JSON) to the repository.

## Service Notes

- In Docker, the engine prioritizes `engine/.env.docker` and logs the active environment source at startup.
- Startup logs include key endpoints (DB host, Redis URL, Ollama URL) for easier debugging.
- Ollama calls include retry logic and startup readiness retries.

## Ollama First Run

On first boot, model initialization can take longer while Ollama pulls missing models.

Model pulling is automatic in Docker Compose via the `ollama_init` one-shot service.
Backend/engine startup waits until this step completes successfully.

- Generation model: `qwen2.5:3b`
- Embeddings model: `nomic-embed-text`

If the first run is slow, keep containers running and watch the Ollama logs until model pull completes.

## Upload Storage Persistence

Uploads are persisted on the host with a shared volume mapping:

- Host path: `./data/uploads`
- Container path: `/app/data/uploads`

Both backend and engine use this same path to avoid file mismatch across services.

## Common Issues

### "Not authorized, no token"

- Cause: missing or invalid `Authorization: Bearer <token>` header.
- Fix: log in again and send the JWT in API requests.

### "Ollama not responding"

- Cause: Ollama container not healthy yet, or model pull still in progress.
- Fix: check `docker-compose logs ollama` and wait for `/api/tags` health to pass.

### "Database connection failed"

- Cause: DB not ready or mismatched DB credentials in env files.
- Fix: verify `.env` and `backend/.env` DB values, then restart with `docker-compose up --build`.

## Ollama GPU/CPU Behavior

- Engine reads `OLLAMA_BASE_URL` and model vars from `engine/.env.docker` in Docker.
- `OLLAMA_NUM_GPU` is an engine hint and defaults to `0` (safe CPU fallback).
- Docker Ollama can run on GPU-enabled hosts or CPU-only hosts without changing env file structure.

