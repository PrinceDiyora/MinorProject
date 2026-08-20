# ─────────────────────────────────────────────────────────────────────────────
# utils/preprocessing.py — Feature engineering helpers
# ─────────────────────────────────────────────────────────────────────────────
from datetime import datetime
from utils.encoders import cyclical_encode


def compute_margin_features(cost: float, price: float) -> dict:
    """Gross margin, margin %, and cost-to-price ratio."""
    gross_margin = price - cost
    margin_pct = gross_margin / price if price > 0 else 0.0
    cost_to_price_ratio = cost / price if price > 0 else 1.0
    return {
        "gross_margin": gross_margin,
        "margin_pct": margin_pct,
        "cost_to_price_ratio": cost_to_price_ratio,
    }


def compute_time_features(hour: int, day_of_week: int = None, month: int = None) -> dict:
    """Cyclical + boolean time features used across all engines.

    Parameters:
        hour: 0-23
        day_of_week: 0-6 (Mon=0) — use current day if None
        month: 1-12 — use current month if None
    """
    now = datetime.now()
    if day_of_week is None:
        day_of_week = now.weekday()
    if month is None:
        month = now.month

    hour_sin, hour_cos = cyclical_encode(hour, 24)
    dow_sin, dow_cos   = cyclical_encode(day_of_week, 7)
    month_sin, month_cos = cyclical_encode(month, 12)

    is_weekend    = int(day_of_week >= 5)
    is_lunch_peak = int(11 <= hour <= 14)
    is_dinner_peak = int(19 <= hour <= 22)
    is_late_night = int(hour >= 23 or hour <= 4)

    # Payday week heuristic: last 7 days of the month
    day_of_month = now.day
    is_payday_week = int(day_of_month >= 25)

    return {
        "hour_sin": hour_sin,
        "hour_cos": hour_cos,
        "dow_sin": dow_sin,
        "dow_cos": dow_cos,
        "month_sin": month_sin,
        "month_cos": month_cos,
        "is_weekend": is_weekend,
        "is_lunch_peak": is_lunch_peak,
        "is_dinner_peak": is_dinner_peak,
        "is_late_night": is_late_night,
        "is_payday_week": is_payday_week,
    }


def compute_competitor_features(competitor_price_idx: float, current_price: float) -> dict:
    """Competitor premium and directional flags."""
    comp_premium = (competitor_price_idx - 1.0) * current_price
    comp_above_us = int(competitor_price_idx > 1.0)
    comp_below_us = int(competitor_price_idx < 1.0)
    return {
        "comp_premium": comp_premium,
        "comp_above_us": comp_above_us,
        "comp_below_us": comp_below_us,
    }
