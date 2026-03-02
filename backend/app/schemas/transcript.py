"""Transcript schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum


class TranscriptExportFormat(str, Enum):
    """Supported export formats."""

    JSON = "json"
    MARKDOWN = "markdown"
    SRT = "srt"
    PDF = "pdf"
    DOCX = "docx"


class SegmentResponse(BaseModel):
    """Transcript segment."""

    speaker_id: str
    speaker_label: Optional[str] = None
    start_time: float
    end_time: float
    text: str
    confidence: Optional[float] = None


class TranscriptCreate(BaseModel):
    """Create transcript request (upload)."""

    title: Optional[str] = None
    source_type: str = "upload"


class TranscriptResponse(BaseModel):
    """Transcript response."""

    id: str
    title: Optional[str] = None
    source_type: str
    raw_text: Optional[str] = None
    full_text: Optional[str] = None
    summary: Optional[str] = None
    action_items: Optional[list] = None
    key_decisions: Optional[list] = None
    duration_seconds: Optional[float] = None
    language: Optional[str] = None
    status: str
    segments: list[SegmentResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class LiveTranscriptChunk(BaseModel):
    """WebSocket chunk for live transcription."""

    text: str
    is_final: bool = False
    timestamp: Optional[float] = None
