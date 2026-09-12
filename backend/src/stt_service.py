import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)
_model = None


def _get_model():
    global _model
    if _model is not None:
        return _model
    try:
        from faster_whisper import WhisperModel
        _model = WhisperModel("base", device="cpu", compute_type="int8")
        logger.info("[STT] faster-whisper base model loaded")
    except ImportError:
        logger.warning("[STT] faster-whisper not installed — run: pip install faster-whisper")
    return _model


def is_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def transcribe(audio_bytes: bytes, language: Optional[str] = None) -> Optional[str]:
    model = _get_model()
    if model is None:
        return None
    try:
        audio_file = io.BytesIO(audio_bytes)
        kwargs: dict = {"beam_size": 1}
        if language:
            kwargs["language"] = language
        segments, info = model.transcribe(audio_file, **kwargs)
        text = " ".join(s.text for s in segments).strip()
        logger.info("[STT] %d bytes → %d chars (lang=%s)", len(audio_bytes), len(text), info.language)
        return text or None
    except Exception as e:
        logger.error("[STT] Transcription error: %s", e)
        return None
