"""ASR service using Faster-Whisper."""

import logging
from pathlib import Path
from typing import Iterator

from app.config import get_settings

logger = logging.getLogger(__name__)


class ASRService:
    """Automatic Speech Recognition using Faster-Whisper."""

    def __init__(self):
        self._model = None
        self._settings = get_settings()

    def _load_model(self):
        """Lazy load the Whisper model."""
        if self._model is None:
            try:
                from faster_whisper import WhisperModel

                self._model = WhisperModel(
                    self._settings.whisper_model_size,
                    device=self._settings.whisper_device,
                    compute_type="float16" if self._settings.whisper_device == "cuda" else "int8",
                )
                logger.info("Faster-Whisper model loaded")
            except Exception as e:
                logger.warning("Faster-Whisper not available, using stub: %s", e)
                self._model = "stub"

    def transcribe_file(self, audio_path: str | Path) -> dict:
        """
        Transcribe an audio file.
        Returns dict with segments, text, language, and duration.
        """
        self._load_model()

        if self._model == "stub":
            return self._stub_transcribe(audio_path)

        from faster_whisper import WhisperModel

        segments, info = self._model.transcribe(
            str(audio_path),
            language=None,  # Auto-detect
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )

        segment_list = []
        full_text_parts = []

        for seg in segments:
            segment_list.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip(),
                "confidence": getattr(seg, "avg_logprob", None),
            })
            full_text_parts.append(seg.text.strip())

        return {
            "segments": segment_list,
            "text": " ".join(full_text_parts).strip(),
            "language": info.language,
            "duration": info.duration,
        }

    def transcribe_stream(self, audio_stream: Iterator[bytes]) -> Iterator[dict]:
        """
        Stream transcription (for real-time use).
        Yields partial results as they become available.
        """
        self._load_model()
        # For true streaming, Faster-Whisper would need chunked processing.
        # This is a placeholder for the streaming interface.
        yield {"text": "", "is_final": False}

    def _stub_transcribe(self, audio_path: str | Path) -> dict:
        """Stub when Whisper is not available."""
        return {
            "segments": [
                {"start": 0.0, "end": 1.0, "text": "[Transcription unavailable - install faster-whisper]", "confidence": 0.0}
            ],
            "text": "[Transcription unavailable - install faster-whisper]",
            "language": "en",
            "duration": 1.0,
        }


# Singleton instance
_asr_service: ASRService | None = None


def get_asr_service() -> ASRService:
    """Get or create ASR service instance."""
    global _asr_service
    if _asr_service is None:
        _asr_service = ASRService()
    return _asr_service
