"""Assistant schemas."""

from typing import Optional
from pydantic import BaseModel
from enum import Enum


class TaskType(str, Enum):
    """Classified task types from STT → Action Router."""

    NOTE = "note"
    REMINDER = "reminder"
    SEARCH = "search"
    DRAFT = "draft"
    SCHEDULE = "schedule"
    SUMMARIZE = "summarize"
    QUESTION = "question"
    GENERAL = "general"


class AssistantQuery(BaseModel):
    """Assistant query (text or transcript reference)."""

    text: str
    transcript_id: Optional[str] = None
    context: Optional[str] = None


class AssistantResponse(BaseModel):
    """Assistant response."""

    reply: str
    task_type: TaskType
    actions_taken: list[str] = []
    suggested_follow_ups: list[str] = []
