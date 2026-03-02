"""FastAPI application entry point."""
from contextlib import asynccontextmanager
import asyncio
import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api.routes import transcripts, assistant, websocket
from app.database import engine, Base

logger = logging.getLogger(__name__)

# Use absolute path - in Docker container, WORKDIR is /app and static is copied there
STATIC_DIR = Path("/app/static")

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
                logger.error("Database unavailable - app will start but API will fail.")
                return

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("STATIC_DIR: %s, exists: %s", STATIC_DIR, STATIC_DIR.exists())
    if STATIC_DIR.exists():
        contents = list(STATIC_DIR.iterdir())
        logger.info("Static dir contents: %s", contents)
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcripts.router, prefix="/api")
app.include_router(assistant.router, prefix="/api")
app.include_router(websocket.router)

@app.get("/health")
async def health():
    return {"status": "ok"}

# Serve frontend static files when available (unified deployment)
if STATIC_DIR.exists():
    # Mount Next.js static assets
    _next_dir = STATIC_DIR / "_next"
    if _next_dir.exists():
        app.mount("/_next", StaticFiles(directory=str(_next_dir)), name="next-assets")

    @app.get("/")
    async def root():
        return FileResponse(str(STATIC_DIR / "index.html"))

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        """Serve SPA - return index.html for client-side routes."""
        file_path = STATIC_DIR / path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
else:
    @app.get("/")
    async def root():
        return {
            "name": "VPA - Virtual Stenographer & Personal Assistant",
            "docs": "/docs",
            "api": "/api",
            "static_dir": str(STATIC_DIR),
            "static_exists": STATIC_DIR.exists(),
        }
