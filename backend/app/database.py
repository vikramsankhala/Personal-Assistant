"""Database connection and session management."""

import ssl
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import get_settings

settings = get_settings()


def _clean_asyncpg_url(url: str) -> tuple[str, dict]:
    """Strip sslmode from URL (asyncpg doesn't support it) and return SSL connect_args."""
    if "sqlite" in url or "+asyncpg" not in url and "postgresql" not in url:
        return url, {}
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    needs_ssl = "sslmode" in query and query["sslmode"][0] in ("require", "verify-full", "verify-ca")
    query.pop("sslmode", None)
    new_query = urlencode(query, doseq=True)
    clean_url = urlunparse(parsed._replace(query=new_query))
    if clean_url.startswith("postgresql://") and "+asyncpg" not in clean_url:
        clean_url = clean_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    connect_args = {"ssl": ssl.create_default_context()} if needs_ssl else {}
    return clean_url, connect_args


# Async (FastAPI) - ensure asyncpg for postgres, strip sslmode (Render compatibility)
_db_url = settings.database_url
_db_url, _async_connect_args = _clean_asyncpg_url(_db_url)
_async_kw = {"echo": settings.debug}
if "sqlite" not in _db_url:
    _async_kw["pool_pre_ping"] = True
if _async_connect_args:
    _async_kw["connect_args"] = _async_connect_args
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
