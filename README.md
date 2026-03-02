# VPA — Virtual Stenographer & Personal Assistant

A full-stack application for real-time transcription, speaker diarization, and AI-powered personal assistance. Built on open-source models: Faster-Whisper, PyAnnote, and Ollama.

## Architecture

```
Audio Input → VAD → ASR (Faster-Whisper) → Diarization (PyAnnote) → NLP/LLM → Output
```

- **Stenographer**: Upload audio (MP3, WAV, M4A, etc.) for transcription with speaker labels, summaries, and action items
- **Assistant**: Natural language commands via LLM (Ollama) — notes, reminders, drafts, Q&A

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.ai) (for LLM)
- PostgreSQL & Redis (or use Docker)

### 1. Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Unix: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: DATABASE_URL, REDIS_URL, etc.
```

Create DB and run:

```bash
# With Docker for Postgres/Redis:
docker compose up -d postgres redis

uvicorn app.main:app --reload --port 8000
```

### 2. Ollama (LLM)

```bash
ollama run llama3.1
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### 4. Optional: Full Docker

```bash
docker compose up -d
# Run Ollama on host: ollama run llama3.1
# Backend will use host.docker.internal:11434 for Ollama
```

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/routes/     # FastAPI routes (transcripts, assistant, websocket)
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # ASR, diarization, LLM, pipeline
│   │   └── tasks/          # Celery tasks
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/                # Next.js App Router
│   ├── components/
│   └── package.json
├── docker-compose.yml
└── README.md
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transcripts/upload` | POST | Upload audio for transcription |
| `/api/transcripts/{id}` | GET | Get transcript |
| `/api/transcripts/{id}/export?format=json\|markdown\|srt` | GET | Export transcript |
| `/api/assistant/chat` | POST | Assistant chat (JSON: `{ text }`) |
| `/ws/transcribe` | WebSocket | Live transcription (placeholder) |

## ML Stack (Open Source)

| Component | Model |
|-----------|-------|
| ASR | Faster-Whisper large-v3 |
| Diarization | PyAnnote 3.1 (requires HF token) |
| LLM | Llama 3.1 via Ollama |
| Embeddings | Chroma + sentence-transformers (for RAG) |

## Configuration

See `backend/.env.example`. Key variables:

- `DATABASE_URL` — PostgreSQL (async)
- `REDIS_URL` — Redis
- `OLLAMA_BASE_URL` — Ollama API (default http://localhost:11434)
- `HF_TOKEN` — HuggingFace token for PyAnnote diarization
- `WHISPER_MODEL_SIZE` — base, small, medium, large-v3

## License

MIT
