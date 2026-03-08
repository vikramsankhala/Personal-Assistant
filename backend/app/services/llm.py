"""LLM service via Anthropic (Claude) only."""

import logging
from typing import Any

import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

FALLBACK_MSG = (
    "I'm not connected to an LLM. Add ANTHROPIC_API_KEY (get one at console.anthropic.com)."
)


class LLMService:
    """LLM integration - Anthropic (Claude) only."""

    def __init__(self):
        self._settings = get_settings()

    async def generate(
        self,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.7,
    ) -> str:
        """Generate completion from Anthropic."""
        if self._settings.anthropic_api_key:
            return await self._generate_anthropic(prompt, system, temperature)
        return FALLBACK_MSG

    async def _generate_anthropic(
        self, prompt: str, system: str | None, temperature: float
    ) -> str:
        """Generate via Anthropic API (Claude)."""
        payload: dict[str, Any] = {
            "model": self._settings.anthropic_model,
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
        }
        if system:
            payload["system"] = system

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": self._settings.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                r.raise_for_status()
                data = r.json()
                return data["content"][0]["text"].strip()
        except Exception as e:
            logger.exception("Anthropic error: %s", e)
            return f"[Anthropic error: {e}]"

    async def classify_intent(self, text: str) -> str:
        """Classify user intent (note, reminder, draft, etc.)."""
        system = """You are an intent classifier. Reply with exactly one word from: note, reminder, search, draft, schedule, summarize, question, general."""
        prompt = f"Classify this user message: {text}"
        result = await self.generate(prompt, system=system, temperature=0.0)
        return result.strip().lower().split()[0] if result else "general"

    async def summarize_transcript(self, text: str) -> str:
        """Summarize transcript text."""
        prompt = f"""Summarize this transcript in 2-4 sentences. Focus on key points and decisions.

Transcript:
{text[:8000]}

Summary:"""
        return await self.generate(prompt, temperature=0.3)

    async def extract_action_items(self, text: str) -> list[str]:
        """Extract action items from transcript."""
        prompt = f"""List action items from this transcript. One per line, start each with "- ".

Transcript:
{text[:6000]}

Action items:"""
        result = await self.generate(prompt, temperature=0.2)
        lines = [l.strip() for l in result.split("\n") if l.strip().startswith("-")]
        return [l.lstrip("- ").strip() for l in lines[:10]]

    async def chat(self, message: str, context: str | None = None) -> str:
        """Assistant chat response."""
        system = """You are a helpful personal assistant. You can take notes, set reminders, draft documents, and answer questions. Be concise and actionable."""
        if context:
            system += f"\n\nContext: {context}"
        return await self.generate(message, system=system)


_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    """Get or create LLM service."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
