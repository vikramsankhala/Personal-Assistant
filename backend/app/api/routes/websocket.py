"""WebSocket routes for live transcription."""

import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.asr import get_asr_service

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)


@router.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """WebSocket endpoint for streaming live transcription."""
    await websocket.accept()

    try:
        asr = get_asr_service()
        buffer = bytearray()

        while True:
            data = await websocket.receive_bytes()
            buffer.extend(data)

            # Process in chunks (e.g., 1 second of audio)
            # For real streaming, you'd use VAD to detect speech segments
            if len(buffer) >= 32000:  # ~1 sec of 16kHz mono
                chunk = bytes(buffer[:32000])
                buffer = buffer[32000:]

                # In production: run ASR on chunk, send partial result
                result = {"text": "", "is_final": False}
                await websocket.send_json(result)

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.exception("WebSocket error: %s", e)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
