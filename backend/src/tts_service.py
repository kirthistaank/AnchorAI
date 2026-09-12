import asyncio
import httpx
import logging
import os
import subprocess
import sys
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)
FISH_SPEECH_URL = "http://localhost:8080"


def _macos_say(text: str) -> Optional[bytes]:
    """Use macOS built-in `say` command — always available, no install needed."""
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            tmp_path = f.name
        subprocess.run(
            ["say", text, "-o", tmp_path, "--data-format=LEF32@22050"],
            check=True, timeout=30, capture_output=True,
        )
        with open(tmp_path, "rb") as f:
            data = f.read()
        os.unlink(tmp_path)
        return data
    except Exception as e:
        logger.error("[TTS] macOS say failed: %s", e)
        return None


async def _fish_speech(text: str) -> Optional[bytes]:
    """Optional: proxy to Fish Speech HTTP server on localhost:8080."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{FISH_SPEECH_URL}/v1/tts",
                json={"text": text, "format": "wav", "streaming": False},
            )
            if resp.status_code == 200:
                return resp.content
    except Exception:
        pass
    return None


async def synthesize(text: str) -> Optional[bytes]:
    # Try Fish Speech first (if running), fall back to macOS say
    fish = await _fish_speech(text)
    if fish:
        return fish
    if sys.platform == "darwin":
        return await asyncio.to_thread(_macos_say, text)
    return None


async def is_available() -> bool:
    if sys.platform == "darwin":
        return True  # macOS say is always present
    # Non-Mac: only available if Fish Speech server is running
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{FISH_SPEECH_URL}/")
            return resp.status_code < 500
    except Exception:
        return False
