# Cognify — High-Level Architecture

```mermaid
flowchart TB
    %% ── Actors ──────────────────────────────────────────────────────────
    User(["👤 User / Browser"])
    Admin(["🛡️ Admin"])

    %% ── Tier 1 : Presentation ───────────────────────────────────────────
    subgraph FE["Frontend  •  React 19 / Vite  •  :3000"]
        direction TB
        UI["Pages & Components\n(React Router, Zustand)"]
        Charts["Analytics / Charts\n(Recharts, FullCalendar)"]
        Export["PDF Export\n(jsPDF, html2canvas)"]
    end

    %% ── Tier 2 : API & Orchestration ────────────────────────────────────
    subgraph BE["Backend  •  Node.js / Express  •  :5000"]
        direction TB
        Auth["Auth\n(Passport.js, JWT,\nGoogle & GitHub OAuth)"]
        Routes["REST API Routes\n/materials /subjects /files\n/quiz /exam /goals /chat\n/analytics /admin /planner"]
        FileHandler["File Handler\n(Multer)"]
        EngineClient["Engine HTTP Client\n(Axios → poll job_id)"]
        DriveClient["Google Drive Client\n(googleapis)"]
        Mailer["Email\n(Nodemailer / SMTP)"]
    end

    %% ── Tier 3 : AI Processing ──────────────────────────────────────────
    subgraph ENG["Engine  •  Python / FastAPI  •  :8000"]
        direction TB
        FAPI["FastAPI App\n(REST endpoints)"]
        Pipeline["Document Pipeline\n(OCR → chunk → embed)"]
        Generator["Material Generator\n(stream_core, LLM calls)"]
        Evaluator["Quiz / Exam Evaluator"]
        GoalsEngine["Goals & Learner-State\n(adaptive difficulty)"]
    end

    subgraph WORKER["Celery Workers  •  Python"]
        direction TB
        TaskQueue["Background Tasks\n(process_document,\ngenerate_material)"]
    end

    %% ── Data / Infrastructure ───────────────────────────────────────────
    subgraph INFRA["Infrastructure"]
        direction LR
        PG[("PostgreSQL :5432\n+ pgvector\n─────────────\nusers · subjects\nmaterials · files\nchunks · chat\ngoals · ratings")]
        Redis[("Redis :6379\nCelery broker\n+ result backend\n+ state cache")]
        Ollama["Ollama  :11434\n─────────────\nqwen2.5:3b\n(generation)\nnomic-embed-text\n(embeddings)"]
        Storage[["Shared File Storage\n/data/uploads"]]
    end

    subgraph EXTERNAL["External Services"]
        GDrive["Google Drive API"]
        GAuth["Google / GitHub OAuth"]
        NeonDB[("Neon PostgreSQL\n(staging only)")]
        SMTP["SMTP Server"]
    end

    %% ── Connections : User ──────────────────────────────────────────────
    User -->|"HTTPS"| FE
    Admin -->|"HTTPS"| FE

    %% ── Connections : Frontend → Backend ────────────────────────────────
    FE -->|"REST  •  JWT Bearer\nVITE_API_URL :5000"| BE

    %% ── Connections : Backend internals ─────────────────────────────────
    BE --> Auth
    BE --> Routes
    BE --> FileHandler
    Routes --> EngineClient
    Routes --> DriveClient
    Routes --> Mailer

    %% ── Connections : Backend → Data ────────────────────────────────────
    BE -->|"pg driver"| PG
    BE -->|"file read/write"| Storage
    DriveClient -->|"OAuth2"| GDrive
    Auth -->|"OAuth2"| GAuth
    Mailer -->|"SMTP"| SMTP

    %% ── Connections : Backend → Engine ──────────────────────────────────
    EngineClient -->|"POST /documents\nPOST /generate/stream\nGET /jobs/:id"| ENG

    %% ── Connections : Engine internals ──────────────────────────────────
    FAPI --> Pipeline
    FAPI --> Generator
    FAPI --> Evaluator
    FAPI --> GoalsEngine

    %% ── Connections : Engine → Celery ───────────────────────────────────
    FAPI -->|"enqueue task\nreturn job_id"| Redis
    Redis -->|"task dispatch"| WORKER
    WORKER --> TaskQueue
    TaskQueue -->|"results"| Redis

    %% ── Connections : Engine / Worker → Data ────────────────────────────
    ENG -->|"SQLAlchemy ORM"| PG
    WORKER -->|"SQLAlchemy ORM"| PG
    ENG -->|"state cache"| Redis
    ENG -->|"file read/write"| Storage
    WORKER -->|"file read"| Storage

    %% ── Connections : Engine / Worker → Ollama ──────────────────────────
    ENG -->|"POST /api/generate\nPOST /api/embed"| Ollama
    WORKER -->|"POST /api/embed"| Ollama

    %% ── Staging overlay ─────────────────────────────────────────────────
    PG -.->|"staging: swap to"| NeonDB

    %% ── Styles ──────────────────────────────────────────────────────────
    classDef frontend fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    classDef backend  fill:#dcfce7,stroke:#22c55e,color:#14532d
    classDef engine   fill:#fef9c3,stroke:#eab308,color:#422006
    classDef worker   fill:#fef3c7,stroke:#f59e0b,color:#422006
    classDef infra    fill:#f3e8ff,stroke:#a855f7,color:#3b0764
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef actor    fill:#fff7ed,stroke:#fb923c,color:#431407

    class FE,UI,Charts,Export frontend
    class BE,Auth,Routes,FileHandler,EngineClient,DriveClient,Mailer backend
    class ENG,FAPI,Pipeline,Generator,Evaluator,GoalsEngine engine
    class WORKER,TaskQueue worker
    class PG,Redis,Ollama,Storage infra
    class GDrive,GAuth,NeonDB,SMTP external
    class User,Admin actor
```

---

## Component Summary

| Layer | Service | Tech | Port |
|-------|---------|------|------|
| **Presentation** | Frontend | React 19, Vite, Zustand, Tailwind | 3000 |
| **API** | Backend | Node.js, Express, Passport.js, JWT | 5000 |
| **AI Processing** | Engine | Python, FastAPI, SQLAlchemy | 8000 |
| **Async Workers** | Celery Workers | Python, Celery 5 | — |
| **Database** | PostgreSQL + pgvector | pg16 + pgvector | 5432 |
| **Cache / Queue** | Redis | redis:7-alpine | 6379 |
| **LLM Runtime** | Ollama | qwen2.5:3b, nomic-embed-text | 11434 |
| **External** | Google OAuth / Drive | googleapis | — |

## Key Data Flows

### 1 — Document Upload & Processing
```
User uploads file
  → Frontend (multipart form)
  → Backend /api/files (Multer stores to /data/uploads)
  → Backend → Engine POST /documents
  → Engine enqueues Celery task via Redis
  → Worker: OCR → chunk → embed (Ollama) → store in PG (chunks+vectors)
  → Backend polls GET /jobs/:id until COMPLETED
  → Frontend shows "ready to generate"
```

### 2 — Material Generation (streaming)
```
User clicks "Generate Summary / Quiz / Flashcards"
  → Frontend SSE / fetch stream
  → Backend POST /api/materials/:id/generate
  → Backend → Engine POST /generate/stream
  → Engine retrieves relevant chunks from PG (vector similarity)
  → Engine streams LLM tokens from Ollama
  → Backend pipes stream → Frontend
  → Frontend renders content in real-time
  → Backend saves final content to PG
```

### 3 — Adaptive Learning Loop
```
User answers quiz / exam
  → Backend records event → Engine POST /goals/learning-events
  → Engine updates learner-state in PG + caches snapshot in Redis
  → Engine returns next recommended difficulty / topic
  → Frontend adjusts next quiz / suggests materials
```
