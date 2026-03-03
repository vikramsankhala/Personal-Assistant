"""Full transcription pipeline: VAD -> ASR -> Diarization -> NLP -> LLM."""
import logging
from pathlib import Path
from typing import Any

from app.services.asr import get_asr_service
from app.services.diarization import get_diarization_service
from app.services.llm import get_llm_service

logger = logging.getLogger(__name__)


class TranscriptionPipeline:
    """Orchestrates the full pipeline from audio to structured output."""

    def __init__(self):
        self.asr = get_asr_service()
        self.diarization = get_diarization_service()
        self.llm = get_llm_service()

    async def process_audio(
        self,
        audio_path: str | Path,
        source_lang: str = None,
        target_lang: str = None,
    ) -> dict[str, Any]:
        """
        Process audio file through full pipeline.
        source_lang: BCP-47 code of spoken language (None = auto-detect)
        target_lang: BCP-47 code for output language (None = same as source)
        Returns structured transcript with segments, summary, action items.
        """
        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # 1. ASR
        asr_result = self.asr.transcribe_file(
            path,
            source_lang=source_lang,
            target_lang=target_lang,
        )
        segments = asr_result["segments"]
        full_text = asr_result["text"]
        language = asr_result.get("language", "en")
        duration = asr_result.get("duration", 0.0)

        # 2. Diarization (if we have meaningful audio)
        if duration > 1.0 and segments:
            diar_segments = self.diarization.diarize(path)
            segments = self.diarization.merge_with_transcription(segments, diar_segments)
        else:
            for seg in segments:
                seg.setdefault("speaker_id", "SPEAKER_00")

        # 3. NLP / LLM extraction (async)
        summary = ""
        action_items = []
        if full_text and len(full_text) > 20:
            summary = await self.llm.summarize_transcript(full_text)
            action_items = await self.llm.extract_action_items(full_text)

        return {
            "segments": segments,
            "full_text": full_text,
            "summary": summary,
            "action_items": action_items,
            "language": language,
            "duration": duration,
        }
