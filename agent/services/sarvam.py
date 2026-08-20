"""
sarvam.py — Sarvam AI STT (saarika:v2) and TTS (bulbul:v2) wrappers.

STT  → POST multipart/form-data to https://api.sarvam.ai/speech-to-text
TTS  → POST JSON            to https://api.sarvam.ai/text-to-speech

Both functions are async and use httpx.AsyncClient.
"""

from __future__ import annotations

import os
import httpx

SARVAM_API_KEY  = os.getenv("SARVAM_API_KEY", "")
STT_URL         = "https://api.sarvam.ai/speech-to-text"
TTS_URL         = "https://api.sarvam.ai/text-to-speech"


async def sarvam_stt(audio_bytes: bytes, language_code: str = "hi-IN") -> dict:
    """
    Transcribe audio bytes using Sarvam saarika:v2.

    Returns:
        {"transcript": str, "language_code": str}
    Raises:
        RuntimeError on HTTP / API errors.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            STT_URL,
            headers={"api-subscription-key": SARVAM_API_KEY},
            files={"file": ("audio.wav", audio_bytes, "audio/wav")},
            data={
                "model":         "saarika:v2.5",
                "language_code": language_code,
            },
        )

    if response.status_code != 200:
        raise RuntimeError(f"Sarvam STT error {response.status_code}: {response.text}")

    data = response.json()
    return {
        "transcript":    data.get("transcript", ""),
        "language_code": data.get("language_code", language_code),
    }


async def sarvam_tts(text: str, language_code: str = "hi-IN") -> bytes:
    """
    Synthesise speech using Sarvam bulbul:v2.

    Returns:
        Raw WAV bytes (decoded from base64).
    Raises:
        RuntimeError on HTTP / API errors.
    """
    import base64

    # Sarvam TTS accepts at most 500 characters per request.
    # Truncate gracefully; the agent should keep replies concise.
    if len(text) > 500:
        text = text[:497] + "..."

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            TTS_URL,
            headers={
                "api-subscription-key": SARVAM_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "inputs":               [text],
                "target_language_code": language_code,
                "speaker":              "anushka",
                "model":                "bulbul:v2",
            },
        )

    if response.status_code != 200:
        raise RuntimeError(f"Sarvam TTS error {response.status_code}: {response.text}")

    data   = response.json()
    audios = data.get("audios", [])
    if not audios:
        raise RuntimeError("Sarvam TTS returned no audio data")

    return base64.b64decode(audios[0])
