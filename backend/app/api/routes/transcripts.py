"""Transcript API routes."""
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Transcript, TranscriptSegment
from app.schemas.transcript import TranscriptResponse, SegmentResponse, TranscriptExportFormat
from app.services.pipeline import TranscriptionPipeline

router = APIRouter(prefix="/transcripts", tags=["transcripts"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/upload", response_model=TranscriptResponse)
async def upload_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_lang: str = Form(None),
    target_lang: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Upload audio file for transcription."""
    # Validate file type
    allowed = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm"}
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed:
        raise HTTPException(400, f"Unsupported format. Allowed: {allowed}")

    transcript_id = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{transcript_id}{suffix}"

    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Create DB record (pending)
    transcript = Transcript(
        id=transcript_id,
        org_id="default",
        user_id="default",
        title=file.filename or "Untitled",
        source_type="upload",
        audio_format=suffix.lstrip("."),
        status="processing",
    )
    db.add(transcript)
    await db.flush()

    async def process():
        pipeline = TranscriptionPipeline()
        result = await pipeline.process_audio(
            save_path,
            source_lang=source_lang,
            target_lang=target_lang,
        )
        from app.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            t = await session.get(Transcript, transcript_id)
            if t:
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
                await session.commit()

    background_tasks.add_task(process)
    return TranscriptResponse(
        id=transcript_id,
        title=transcript.title,
        source_type=transcript.source_type,
        status="processing",
        segments=[],
        created_at=transcript.created_at,
    )


@router.get("/{transcript_id}", response_model=TranscriptResponse)
async def get_transcript(transcript_id: str, db: AsyncSession = Depends(get_db)):
    """Get transcript by ID."""
    transcript = await db.get(Transcript, transcript_id)
    if not transcript:
        raise HTTPException(404, "Transcript not found")
    segments = [
        SegmentResponse(
            speaker_id=s.speaker_id or "SPEAKER_00",
            speaker_label=s.speaker_label,
            start_time=s.start_time,
            end_time=s.end_time,
            text=s.text,
            confidence=s.confidence,
        )
        for s in transcript.segments
    ]
    return TranscriptResponse(
        id=transcript.id,
        title=transcript.title,
        source_type=transcript.source_type,
        raw_text=transcript.raw_text,
        full_text=transcript.full_text,
        summary=transcript.summary,
        action_items=transcript.action_items,
        key_decisions=transcript.key_decisions,
        duration_seconds=transcript.duration_seconds,
        language=transcript.language,
        status=transcript.status,
        segments=segments,
        created_at=transcript.created_at,
    )


@router.get("/{transcript_id}/export")
async def export_transcript(
    transcript_id: str,
    format: TranscriptExportFormat = TranscriptExportFormat.JSON,
    db: AsyncSession = Depends(get_db),
):
    """Export transcript in various formats."""
    transcript = await db.get(Transcript, transcript_id)
    if not transcript:
        raise HTTPException(404, "Transcript not found")
    if format == TranscriptExportFormat.JSON:
        from fastapi.responses import JSONResponse
        return JSONResponse({
            "id": transcript.id,
            "title": transcript.title,
            "full_text": transcript.full_text,
            "summary": transcript.summary,
            "action_items": transcript.action_items,
            "segments": [
                {"speaker_id": s.speaker_id, "start": s.start_time, "end": s.end_time, "text": s.text}
                for s in transcript.segments
            ],
        })
    if format == TranscriptExportFormat.MARKDOWN:
        from fastapi.responses import PlainTextResponse
        md = f"# {transcript.title or 'Transcript'}\n\n"
        if transcript.summary:
            md += f"## Summary\n{transcript.summary}\n\n"
        md += "## Transcript\n\n"
        for s in transcript.segments:
            md += f"**[{s.speaker_id}]** ({s.start_time:.1f}s - {s.end_time:.1f}s): {s.text}\n\n"
        if transcript.action_items:
            md += "## Action Items\n"
            for a in transcript.action_items:
                md += f"- {a}\n"
        return PlainTextResponse(md)
    if format == TranscriptExportFormat.SRT:
        from fastapi.responses import PlainTextResponse
        srt_lines = []
        for i, s in enumerate(transcript.segments, 1):
            start = _format_srt_time(s.start_time)
            end = _format_srt_time(s.end_time)
            srt_lines.append(f"{i}\n{start} --> {end}\n{s.text}\n")
        return PlainTextResponse("\n".join(srt_lines))
    raise HTTPException(400, f"Export format {format} not yet implemented")


def _format_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
