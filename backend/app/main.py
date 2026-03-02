"""FastAPI application entry point."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import transcripts, assistant, websocket
from app.database import engine, Base

logger = logging.getLogger(__name__)


async def init_db():
    """Create tables on startup (for dev; use Alembic in production)."""
    for attempt in range(6):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created")
            return
        except Exception as e:
            logger.warning("Database init attempt %d/6 failed: %s", attempt + 1, e)
            if attempt < 5:
                await asyncio.sleep(10)
            else:
                logger.error("Database unavailable - app will start but API will fail. Check DATABASE_EXTERNAL_URL and DB IP allow list.")
                return  # Don't block startup - allows Render to detect port


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
