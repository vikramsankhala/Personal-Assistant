"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import transcripts, assistant, websocket
from app.database import engine, Base

# Create tables on startup (for dev; use Alembic in production)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await engine.dispose()


app = FastAPI(
    title="Virtual Stenographer & Personal Assistant",
    description="ASR, diarization, and LLM-powered assistant",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcripts.router, prefix="/api")
app.include_router(assistant.router, prefix="/api")
app.include_router(websocket.router)


@app.get("/")
async def root():
    return {
        "name": "VPA - Virtual Stenographer & Personal Assistant",
        "docs": "/docs",
        "api": "/api",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
