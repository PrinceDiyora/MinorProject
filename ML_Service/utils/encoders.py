# ─────────────────────────────────────────────────────────────────────────────
# utils/encoders.py — Label encoding + cyclical time helpers
# ─────────────────────────────────────────────────────────────────────────────
import math
import numpy as np


def safe_label_encode(encoder, value: str) -> int:
    """Encode a label, returning -1 for unknown values instead of crashing."""
    try:
        return int(encoder.transform([value])[0])
    except (ValueError, KeyError):
        return -1


def cyclical_encode(value: float, period: float) -> tuple[float, float]:
    """Return (sin, cos) for a cyclical feature.

    E.g. hour_of_day: value=14, period=24 → (sin, cos).
    """
    angle = 2 * math.pi * value / period
    return math.sin(angle), math.cos(angle)
