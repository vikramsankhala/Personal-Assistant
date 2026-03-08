# VPA — Railway.com Deployment Guide

## Logic Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VPA APPLICATION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js static)                                                  │
│  • page.tsx → Tabbed UI: Transcribe | Assistant                             │
│  • TranscriptionView → Upload audio, live capture, meeting history          │
│  • AssistantView → Chat with Claude                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKEND (FastAPI)                                                           │
│  • Serves static frontend from /app/static (unified deploy)                 │
│  • /api/transcripts/* → Transcription pipeline                               │
│  • /api/assistant/chat → Anthropic Claude                                    │
│  • /health → Health check                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌───────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ TRANSCRIPTION     │     │ ASSISTANT (LLM)     │     │ DATABASE            │
│ PIPELINE          │     │ Anthropic only      │     │ PostgreSQL          │
│                   │     │                     │     │                     │
│ 1. ASR (Whisper)  │     │ • classify_intent   │     │ • Transcript        │
│ 2. Diarization    │     │ • summarize          │     │ • TranscriptSegment │
│ 3. LLM (Claude)   │     │ • extract_actions   │     │                     │
│    • summarize    │     │ • chat               │     │                     │
│    • action_items│     │                     │     │                     │
└───────────────────┘     └─────────────────────┘     └─────────────────────┘
```

---

## Transcription Flow (Detailed)

```
Audio Upload (POST /api/transcripts/upload)
    │
    ├─► Save file to uploads/
    ├─► Create Transcript record (status: processing)
    └─► Background task: TranscriptionPipeline.process_audio()
            │
            ├─► 1. ASR (Faster-Whisper)
            │       • Transcribe audio → segments with timestamps
            │       • Optional: translate to English if target_lang ≠ source_lang
            │
            ├─► 2. Diarization (PyAnnote)
            │       • Assign speaker labels (SPEAKER_00, SPEAKER_01, ...)
            │       • Merge with ASR segments
            │
            ├─► 3. LLM (Anthropic Claude)
            │       • summarize_transcript() → 2–4 sentence summary
            │       • extract_action_items() → bullet list
            │
            └─► 4. Update DB
                    • Save segments, summary, action_items
                    • status: completed
```

---

## Assistant Flow (Detailed)

```
Chat (POST /api/assistant/chat)
    │
    ├─► 1. classify_intent(text) → note | reminder | draft | schedule | ...
    │
    ├─► 2. Load context (if transcript_id provided)
    │
    └─► 3. llm.chat(message, context)
            │
            └─► Anthropic API (Claude)
                    • POST https://api.anthropic.com/v1/messages
                    • Model: claude-3-5-haiku (configurable)
                    • Returns assistant reply
```

---

## LLM Provider: Anthropic Only

| Provider   | Status   | Use Case        |
|-----------|----------|------------------|
| Anthropic | **Active** | All LLM tasks   |
| Groq      | Removed  | —                |
| Ollama    | Removed  | —                |

**Required:** `ANTHROPIC_API_KEY` — Get one at [console.anthropic.com](https://console.anthropic.com)

---

## Railway.com Deployment

### Prerequisites

- GitHub repo: `vikramsankhala/Personal-Assistant`
- [Railway](https://railway.app) account
- Anthropic API key

### Step 1: Create Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** → Connect `Personal-Assistant`

### Step 2: Add PostgreSQL

1. In project → **+ New** → **Database** → **PostgreSQL**
2. Railway provisions a Postgres instance and sets `DATABASE_URL`

### Step 3: Configure Web Service

1. **+ New** → **GitHub Repo** → Select `Personal-Assistant`
2. Railway detects the root `Dockerfile` (unified frontend + backend)
3. Optional: `railway.json` in repo root configures Dockerfile path
4. **Settings** → **Variables** → Add:

| Variable               | Value                          |
|------------------------|--------------------------------|
| `ANTHROPIC_API_KEY`    | Your API key from Anthropic    |
| `DATABASE_URL`        | (Auto-set by Railway Postgres) |

4. **Settings** → **Deploy**:
   - **Root Directory:** (leave empty)
   - **Dockerfile Path:** `./Dockerfile`
   - **Watch Paths:** (default)

### Step 4: Generate Domain

1. **Settings** → **Networking** → **Generate Domain**
2. Your app will be live at `https://your-app.up.railway.app`

---

## Environment Variables (Railway)

| Variable              | Required | Description                          |
|-----------------------|----------|--------------------------------------|
| `ANTHROPIC_API_KEY`   | Yes      | Claude API key                       |
| `DATABASE_URL`        | Yes      | Auto-set by Railway Postgres         |
| `ANTHROPIC_MODEL`     | No       | Default: `claude-3-5-haiku-20241022` |
| `HF_TOKEN`            | No       | For PyAnnote diarization             |

---

## Build & Run (Dockerfile)

```
1. Frontend: npm install → npm run build (static export)
2. Copy frontend/out → backend/static
3. Backend: pip install -r requirements.txt
4. CMD: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Railway sets `PORT` automatically. The app serves:
- `/` — Web UI
- `/api/*` — API
- `/docs` — OpenAPI docs

---

## Troubleshooting

| Issue                    | Fix                                                |
|--------------------------|----------------------------------------------------|
| Assistant shows fallback | Add `ANTHROPIC_API_KEY` in Railway variables      |
| DB connection failed     | Ensure Postgres is in same project; check `DATABASE_URL` |
| Build fails              | Verify root `Dockerfile` is used, not `backend/Dockerfile` |
