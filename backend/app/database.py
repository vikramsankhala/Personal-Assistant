"""Database connection and session management."""

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import get_settings

settings = get_settings()

# Async (FastAPI) - ensure asyncpg for postgres
_db_url = settings.database_url
if _db_url.startswith("postgresql://") and "+asyncpg" not in _db_url:
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
_async_kw = {"echo": settings.debug}
if "sqlite" not in _db_url:
    _async_kw["pool_pre_ping"] = True
engine = create_async_engine(_db_url, **_async_kw)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all models."""

    pass


# Sync (Celery workers)
_sync_url = settings.database_url_sync_resolved
_sync_kw = {"echo": settings.debug}
if "sqlite" in _sync_url:
    _sync_kw["connect_args"] = {"check_same_thread": False}
else:
    _sync_kw["pool_pre_ping"] = True
engine_sync = create_engine(_sync_url, **_sync_kw)
SessionLocalSync = sessionmaker(engine_sync, autocommit=False, autoflush=False)


async def get_db() -> AsyncSession:
    """Dependency for FastAPI to get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
