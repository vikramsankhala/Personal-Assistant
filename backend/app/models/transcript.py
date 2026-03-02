"""Transcript and related models."""

from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, Text, Float, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Transcript(Base):
    """Main transcript record."""

    __tablename__ = "transcripts"

    id = Column(String(36), primary_key=True, index=True)
    org_id = Column(String(36), index=True, nullable=True)  # FK when orgs exist
    user_id = Column(String(36), index=True, nullable=True)

    title = Column(String(255), nullable=True)
    source_type = Column(String(50))  # live, upload, phone_call
    audio_format = Column(String(20), nullable=True)  # mp3, wav, m4a

    raw_text = Column(Text, nullable=True)
    full_text = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    action_items = Column(JSON, nullable=True)  # List of extracted action items
    key_decisions = Column(JSON, nullable=True)
    entities = Column(JSON, nullable=True)

    duration_seconds = Column(Float, nullable=True)
    language = Column(String(10), nullable=True)
    confidence_score = Column(Float, nullable=True)

    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    segments = relationship("TranscriptSegment", back_populates="transcript")

    def __repr__(self) -> str:
        return f"<Transcript {self.id} {self.title}>"


class TranscriptSegment(Base):
    """Individual segment with speaker and timestamp."""

    __tablename__ = "transcript_segments"

    id = Column(String(36), primary_key=True, index=True)
    transcript_id = Column(String(36), ForeignKey("transcripts.id"), index=True)

    speaker_id = Column(String(50), nullable=True)  # SPEAKER_00, SPEAKER_01
    speaker_label = Column(String(100), nullable=True)  # Optional display name

    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    text = Column(Text, nullable=False)
    confidence = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    transcript = relationship("Transcript", back_populates="segments")

    def __repr__(self) -> str:
        return f"<Segment {self.speaker_id} {self.start_time:.1f}s - {self.text[:30]}...>"


class TranscriptMetadata(Base):
    """Audit and version metadata for transcripts."""

    __tablename__ = "transcript_metadata"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transcript_id = Column(String(36), ForeignKey("transcripts.id"), index=True)

    version = Column(Integer, default=1)
    operation = Column(String(50))  # create, update, export, delete
    changed_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
