"""WebSocket routes for real-time transcription."""
import asyncio
import json
import logging
import tempfile
import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.asr import get_asr_service

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)

# Minimum bytes before we attempt transcription:
# 16kHz mono 16-bit PCM = 32000 bytes/sec  →  ~0.5 sec chunk
CHUNK_BYTES = 16000  # 0.5 s of 16kHz mono PCM


@router.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """Real-time transcription via WebSocket.

    Protocol
    --------
    Client  → server : raw PCM bytes  (16 kHz, mono, 16-bit little-endian)
                       OR the JSON string  {"type": "stop"}
    Server  → client : JSON  {"text": str, "is_final": bool, "error"?: str}
    """
    await websocket.accept()
    asr = get_asr_service()
    buffer = bytearray()
    transcript_parts: list[str] = []

    async def transcribe_chunk(chunk: bytes) -> str | None:
        """Write chunk to a temp WAV file and transcribe it."""
        loop = asyncio.get_event_loop()
        try:
            with tempfile.NamedTemporaryFile(
                suffix=".raw", delete=False
            ) as tmp:
                tmp.write(chunk)
                tmp_path = tmp.name

            # Run blocking Whisper call in thread pool so we don't block the event loop
            result = await loop.run_in_executor(
                None,
                lambda: asr.transcribe_raw_pcm(tmp_path, sample_rate=16000),
            )
            return result.get("text", "").strip()
        except Exception as exc:
            logger.warning("Chunk transcription failed: %s", exc)
            return None
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    try:
        while True:
            try:
                # receive_bytes or receive_text (for control messages)
                message = await asyncio.wait_for(
                    websocket.receive(), timeout=30.0
                )
            except asyncio.TimeoutError:
                # Keep-alive ping
                await websocket.send_json({"text": "", "is_final": False, "ping": True})
                continue

            # Handle text control messages
            if message["type"] == "websocket.receive" and message.get("text"):
                try:
                    ctrl = json.loads(message["text"])
                    if ctrl.get("type") == "stop":
                        # Flush remaining buffer
                        if buffer:
                            text = await transcribe_chunk(bytes(buffer))
                            buffer.clear()
                            if text:
                                transcript_parts.append(text)
                                await websocket.send_json(
                                    {"text": text, "is_final": True}
                                )
                        full = " ".join(transcript_parts)
                        await websocket.send_json(
                            {"text": full, "is_final": True, "complete": True}
                        )
                        break
                except json.JSONDecodeError:
                    pass
                continue

            # Handle binary audio data
            if message["type"] == "websocket.receive" and message.get("bytes"):
                data: bytes = message["bytes"]
                buffer.extend(data)

                # Process when we have enough audio
                while len(buffer) >= CHUNK_BYTES:
                    chunk = bytes(buffer[:CHUNK_BYTES])
                    buffer = buffer[CHUNK_BYTES:]

                    text = await transcribe_chunk(chunk)
                    if text:
                        transcript_parts.append(text)
                        await websocket.send_json(
                            {"text": text, "is_final": False}
                        )

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.exception("WebSocket error: %s", e)
        try:
            await websocket.send_json({"text": "", "is_final": True, "error": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
