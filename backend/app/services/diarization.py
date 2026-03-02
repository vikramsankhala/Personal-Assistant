"""Speaker diarization using PyAnnote.audio."""

import logging
from pathlib import Path
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


class DiarizationService:
    """Speaker diarization - who said what."""

    def __init__(self):
        self._pipeline = None
        self._settings = get_settings()

    def _load_pipeline(self):
        """Lazy load PyAnnote pipeline."""
        if self._pipeline is None:
            try:
                from pyannote.audio import Pipeline

                if not self._settings.hf_token:
                    logger.warning("HF_TOKEN not set - diarization disabled")
                    self._pipeline = "stub"
                    return

                self._pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=self._settings.hf_token,
                )
                logger.info("PyAnnote diarization pipeline loaded")
            except Exception as e:
                logger.warning("PyAnnote not available: %s", e)
                self._pipeline = "stub"

    def diarize(self, audio_path: str | Path) -> list[dict[str, Any]]:
        """
        Run diarization on audio file.
        Returns list of {start, end, speaker} segments.
        """
        self._load_pipeline()

        if self._pipeline == "stub":
            return [{"start": 0.0, "end": 1.0, "speaker": "SPEAKER_00"}]

        diarization = self._pipeline(
            str(audio_path),
            min_speakers=self._settings.diarization_min_speakers,
            max_speakers=self._settings.diarization_max_speakers,
        )

        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker,
            })
        return segments

    def merge_with_transcription(
        self,
        asr_segments: list[dict],
        diarization_segments: list[dict],
    ) -> list[dict]:
        """
        Merge ASR segments with diarization to assign speakers to text.
        """
        result = []
        for asr_seg in asr_segments:
            start, end = asr_seg["start"], asr_seg["end"]
            mid = (start + end) / 2
            speaker = "SPEAKER_00"
            for diar_seg in diarization_segments:
                if diar_seg["start"] <= mid <= diar_seg["end"]:
                    speaker = diar_seg["speaker"]
                    break
            result.append({
                **asr_seg,
                "speaker_id": speaker,
            })
        return result


_diarization_service: DiarizationService | None = None


def get_diarization_service() -> DiarizationService:
    """Get or create diarization service."""
    global _diarization_service
    if _diarization_service is None:
        _diarization_service = DiarizationService()
    return _diarization_service
