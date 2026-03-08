"""Application configuration."""

from functools import lru_cache
from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database (Render sets DATABASE_URL; use DATABASE_EXTERNAL_URL if internal fails)
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/vpa"
    database_url_sync: str | None = None
    database_url_external: str | None = None  # Override: external URL when internal DNS fails

    @computed_field
    @property
    def database_url_resolved(self) -> str:
        """Use external URL if set (Render workaround when internal DNS fails)."""
        return self.database_url_external or self.database_url

    @computed_field
    @property
    def database_url_sync_resolved(self) -> str:
        return self.database_url_sync or self.database_url_resolved.replace("+asyncpg", "")

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"

    # Ollama (local)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"

    # Groq (cloud - free tier at groq.com)
    groq_api_key: str | None = None
    groq_model: str = "llama-3.1-8b-instant"

    # HuggingFace (for PyAnnote)
    hf_token: str | None = None

    # Chroma
    chroma_persist_dir: str = "./data/chroma"

    # App
    secret_key: str = "change-me-in-production"
    debug: bool = False
    log_level: str = "INFO"

    # PII
    pii_redaction_enabled: bool = True

    # ASR
    whisper_model_size: str = "large-v3"
    whisper_device: str = "cuda"  # or "cpu"

    # Diarization
    diarization_min_speakers: int = 2
    diarization_max_speakers: int = 10


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
