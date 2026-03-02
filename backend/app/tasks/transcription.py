"""Transcription Celery tasks."""

import uuid
from pathlib import Path

import asyncio

from app.celery_app import app
from app.database import SessionLocalSync
from app.models import Transcript, TranscriptSegment
from app.services.pipeline import TranscriptionPipeline


@app.task(bind=True, max_retries=3)
def process_transcription(self, transcript_id: str, audio_path: str):
    """
    Process audio file and update transcript.
    Use this for production instead of FastAPI BackgroundTasks.
    """
    pipeline = TranscriptionPipeline()
    path = Path(audio_path)

    if not path.exists():
        raise FileNotFoundError(f"Audio not found: {audio_path}")

    result = asyncio.run(pipeline.process_audio(path))

    with SessionLocalSync() as session:
        t = session.get(Transcript, transcript_id)
        if not t:
            return
        t.raw_text = result["full_text"]
        t.full_text = result["full_text"]
        t.summary = result["summary"]
        t.action_items = result["action_items"]
        t.duration_seconds = result["duration"]
        t.language = result["language"]
        t.status = "completed"
        for seg in result["segments"]:
            s = TranscriptSegment(
                id=str(uuid.uuid4()),
                transcript_id=transcript_id,
                speaker_id=seg.get("speaker_id", "SPEAKER_00"),
                start_time=seg["start"],
                end_time=seg["end"],
                text=seg["text"],
                confidence=seg.get("confidence"),
            )
            session.add(s)
        session.commit()
