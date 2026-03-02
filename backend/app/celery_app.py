"""Celery application for async task processing."""

from celery import Celery
from app.config import get_settings

settings = get_settings()

app = Celery(
    "vpa",
    broker=settings.celery_broker_url,
    backend=settings.redis_url,
    include=["app.tasks.transcription"],
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour for long audio
    worker_prefetch_multiplier=1,
)
