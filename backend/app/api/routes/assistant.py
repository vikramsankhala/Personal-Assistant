"""Personal Assistant API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.assistant import AssistantQuery, AssistantResponse, TaskType
from app.services.llm import get_llm_service

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat", response_model=AssistantResponse)
async def chat(
    query: AssistantQuery,
    db: AsyncSession = Depends(get_db),
):
    """Process natural language command or question."""
    llm = get_llm_service()

    # Classify intent
    task_type_str = await llm.classify_intent(query.text)
    try:
        task_type = TaskType(task_type_str)
    except ValueError:
        task_type = TaskType.GENERAL

    # Build context from transcript if provided
    context = query.context
    if query.transcript_id and not context:
        from app.models import Transcript
        t = await db.get(Transcript, query.transcript_id)
        if t and t.full_text:
            context = t.full_text[:2000]

    # Generate response
    reply = await llm.chat(query.text, context=context)

    return AssistantResponse(
        reply=reply,
        task_type=task_type,
        actions_taken=[],
        suggested_follow_ups=[],
    )
