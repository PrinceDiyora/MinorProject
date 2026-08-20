# ─────────────────────────────────────────────────────────────────────────────
# engines/engine3.py — Strategic Pricing Inference (Three-Stage Cascade)
#
# Model A: XGBoost classifier → should the price change?  (binary)
# Model B: XGBoost classifier → direction (1=increase, 0=decrease)
# Model C: XGBoost regressor  → magnitude (UNUSED: R²=-3.11, 1-iteration stump)
#
# Quadrant-guided overrides (menu engineering theory):
#   Stars      q=0  high margin, low pop   → ALWAYS decrease  (promote via price)
#   Puzzles    q=1  high margin, high pop  → trust Model A/B  (premium candidate)
#   Plowhorses q=3  low margin, high pop   → ALWAYS increase  (price-inelastic)
#   Dogs       q=2  low margin, low pop    → trust Model A/B  (ambiguous)
#
# Key metadata thresholds (from metadata.json):
#   stage_A = 0.30, stage_B = 0.30
#   pop_median = 0.5011, margin_median = 0.6667
# ─────────────────────────────────────────────────────────────────────────────
import numpy as np
import pandas as pd
import logging

from models.model_loader import model_store
from schemas.engine3_schema import Engine3Request, Engine3Response
from utils.encoders import safe_label_encode
from utils.preprocessing import (
    compute_margin_features,
    compute_time_features,
    compute_competitor_features,
)
from config import MAX_STRATEGIC_CHANGE_PCT

logger = logging.getLogger("ml_service")

TREND_MAP = {"falling": -1, "stable": 0, "rising": 1}


def _determine_quadrant(
    avg_margin: float,
    popularity_pct: float,
    meta: dict,
    batch_margin_median: float = None,   # use restaurant's own median if available
) -> int:
    """BCG-style quadrant classification.

    Uses batch_margin_median (the actual median margin across this restaurant's items)
    in preference to the training-time margin_median. This ensures the top 50%
    of items by margin are classified as 'high margin' relative to THIS restaurant,
    not the training restaurants which may have had different pricing structures.
    """
    margin_med = (
        batch_margin_median
        if batch_margin_median is not None
        else meta.get("matrix", {}).get("margin_median", 0.6667)
    )
    pop_med    = meta.get("matrix", {}).get("pop_median", 0.5011)
    high_margin     = avg_margin >= margin_med
    high_popularity = popularity_pct >= pop_med
    if high_margin and not high_popularity:  return 0  # Stars
    if high_margin and high_popularity:      return 1  # Puzzles
    if not high_margin and not high_popularity: return 2  # Dogs
    return 3  # Plowhorses



def _rule_based_magnitude(
    direction: str,
    req: Engine3Request,
    margin: dict,
    popularity_pct: float,
    meta: dict,
) -> float:
    """
    Magnitude (% price change) computed from business signals.
    Model C is not used because its R²=-3.11 and best_iterations=1.
    """
    pop_med = meta.get("matrix", {}).get("pop_median", 0.5011)

    if direction == "increase":
        # Competitor premium (how much higher they are)
        comp_gap_pct  = max(0.0, (req.competitor_price_idx - 1.0) * 100)
        # Margin headroom vs historical average
        margin_bonus  = max(0.0, (margin["margin_pct"] - req.avg_margin) * 20)
        # Base 4% + up to 8% from competitor gap + up to 3% margin bonus
        magnitude_pct = 4.0 + min(comp_gap_pct * 0.5, 8.0) + min(margin_bonus, 3.0)
    else:
        # Demand deficit vs median
        demand_deficit = max(0.0, pop_med - popularity_pct)
        # High-margin items can afford a deeper cut to stimulate volume
        margin_bonus   = max(0.0, (req.avg_margin - 0.5) * 20)
        # Base 5% + up to 10% from demand shortfall + up to 5% margin bonus
        magnitude_pct  = 5.0 + min(demand_deficit * 15, 10.0) + min(margin_bonus, 5.0)

    return max(2.0, min(magnitude_pct, MAX_STRATEGIC_CHANGE_PCT))


def predict_optimization(
    req: Engine3Request,
    max_demand_7d: int = 0,
) -> Engine3Response:
    """
    Three-stage strategic pricing cascade with quadrant-guided overrides.

    Parameters
    ----------
    req           : Engine3Request
    max_demand_7d : max demand across all items in the current batch (for
                    relative popularity normalisation). Pass 0 for single calls.
    """
    try:
        store = model_store
        meta  = store.e3_meta
        feature_names = meta["features"]
        thresholds    = meta.get("thresholds", {})
        threshold_a   = thresholds.get("stage_A", 0.3)
        threshold_b   = thresholds.get("stage_B", 0.3)

        # ── Hard gate: zero demand → no suggestion ────────────────────────────
        if req.demand_7d == 0:
            return Engine3Response(
                success=True, change=False, direction=None,
                delta=0.0, new_price=req.current_price,
                quadrant=None, quadrant_name="No sales history",
            )

        # ── Encode categoricals ──────────────────────────────────────────────
        item_name_enc     = safe_label_encode(store.e3_le_item, req.item_name)
        item_category_enc = safe_label_encode(store.e3_le_cat, req.category)

        # ── Derived features ─────────────────────────────────────────────────
        margin     = compute_margin_features(req.cost_price, req.current_price)
        time_feats = compute_time_features(12)   # strategic = noon proxy
        comp       = compute_competitor_features(req.competitor_price_idx, req.current_price)

        # Relative popularity: fraction of the highest-demand item in the batch
        normalizer     = max(max_demand_7d, 1)
        popularity_pct = round(req.demand_7d / normalizer, 6)
        rolling_7d_qty = req.demand_7d
        popularity_momentum = TREND_MAP.get(req.trend, 0)
        quantity_sold  = req.demand_7d

        # ── Quadrant ─────────────────────────────────────────────────────────
        quadrant = _determine_quadrant(
            req.avg_margin,
            popularity_pct,
            meta,
            batch_margin_median=req.batch_margin_median,  # restaurant-relative threshold
        )
        is_star      = int(quadrant == 0)
        is_puzzle    = int(quadrant == 1)
        is_dog       = int(quadrant == 2)
        is_plowhorse = int(quadrant == 3)
        quadrant_names = meta.get("q_names", {})
        quadrant_name  = quadrant_names.get(str(quadrant), "Unknown")

        # ── Feature vector ───────────────────────────────────────────────────
        item_avg_margin     = req.avg_margin
        item_avg_popularity = popularity_pct
        margin_x_popularity = item_avg_margin * item_avg_popularity
        margin_headroom     = margin["margin_pct"] - req.avg_margin
        price_vs_cost_ratio = req.current_price / req.cost_price if req.cost_price > 0 else 1.0

        features = {
            "item_name_enc":       item_name_enc,
            "item_category_enc":   item_category_enc,
            "item_avg_margin":     item_avg_margin,
            "item_avg_popularity": item_avg_popularity,
            "margin_x_popularity": margin_x_popularity,
            "quadrant":            quadrant,
            "is_star":             is_star,
            "is_puzzle":           is_puzzle,
            "is_dog":              is_dog,
            "is_plowhorse":        is_plowhorse,
            "margin_pct":          margin["margin_pct"],
            "gross_margin":        margin["gross_margin"],
            "cost_ratio":          margin["cost_to_price_ratio"],
            "margin_headroom":     margin_headroom,
            "popularity_pct":      popularity_pct,
            "rolling_7d_qty":      rolling_7d_qty,
            "popularity_momentum": popularity_momentum,
            "quantity_sold":       quantity_sold,
            "base_cost":           req.cost_price,
            "base_price":          req.current_price,
            "price_vs_cost_ratio": price_vs_cost_ratio,
            "competitor_price_idx": req.competitor_price_idx,
            "comp_premium":        comp["comp_premium"],
            "comp_above_us":       comp["comp_above_us"],
            "comp_below_us":       comp["comp_below_us"],
            "hour_sin":            time_feats["hour_sin"],
            "hour_cos":            time_feats["hour_cos"],
            "dow_sin":             time_feats["dow_sin"],
            "dow_cos":             time_feats["dow_cos"],
            "month_sin":           time_feats["month_sin"],
            "month_cos":           time_feats["month_cos"],
            "is_weekend":          time_feats["is_weekend"],
            "is_lunch_peak":       time_feats["is_lunch_peak"],
            "is_dinner_peak":      time_feats["is_dinner_peak"],
            "is_late_night":       time_feats["is_late_night"],
            "is_payday_week":      time_feats["is_payday_week"],
        }

        X = pd.DataFrame([features])[feature_names]

        # ═══════════════════════════════════════════════════════════════════════
        # QUADRANT-GUIDED DECISION (overrides model where direction is certain)
        # ═══════════════════════════════════════════════════════════════════════

        # ── Stars (q=0): high margin, low popularity ──────────────────────────
        # Menu engineering: "push with discounts/promotion" = DECREASE price
        # We bypass Stage A because Stars with infrequent orders have sparse
        # training signal → Stage A often votes "no change" incorrectly.
        if quadrant == 0:
            direction     = "decrease"
            magnitude_pct = _rule_based_magnitude(direction, req, margin, popularity_pct, meta)
            delta         = round(-req.current_price * (magnitude_pct / 100), 2)
            new_price     = round(req.current_price + delta, 2)
            cost_floor    = round(req.cost_price * 1.20, 2)
            if new_price < cost_floor:
                new_price = cost_floor
                delta     = round(new_price - req.current_price, 2)
            return Engine3Response(
                success=True, change=True,
                direction=direction, delta=delta, new_price=new_price,
                quadrant=quadrant, quadrant_name=quadrant_name,
            )

        # ── Plowhorses (q=3): low margin, high popularity ─────────────────────
        # Menu engineering: "raise price — demand is price-inelastic" = INCREASE
        # Bypass Stage A for the same reason (infrequent price changes in training).
        if quadrant == 3:
            direction     = "increase"
            magnitude_pct = _rule_based_magnitude(direction, req, margin, popularity_pct, meta)
            delta         = round(req.current_price * (magnitude_pct / 100), 2)
            new_price     = round(req.current_price + delta, 2)
            cost_floor    = round(req.cost_price * 1.20, 2)
            if new_price < cost_floor:
                new_price = cost_floor
                delta     = round(new_price - req.current_price, 2)
            return Engine3Response(
                success=True, change=True,
                direction=direction, delta=delta, new_price=new_price,
                quadrant=quadrant, quadrant_name=quadrant_name,
            )

        # ═══════════════════════════════════════════════════════════════════════
        # MODEL-GUIDED DECISION (Puzzles q=1 and Dogs q=2)
        # ═══════════════════════════════════════════════════════════════════════
        # Puzzles (high margin, high pop) and Dogs (low margin, low pop) have
        # ambiguous menu-engineering direction → let the model decide.

        # Stage A: should the price change at all?
        prob_a = float(store.e3_model_a.predict_proba(X)[:, 1][0])
        if prob_a < threshold_a:
            return Engine3Response(
                success=True, change=False, direction=None,
                delta=0.0, new_price=req.current_price,
                quadrant=quadrant, quadrant_name=quadrant_name,
                prob_a=round(prob_a, 4),
            )

        # Stage B: increase or decrease?
        prob_b    = float(store.e3_model_b.predict_proba(X)[:, 1][0])
        direction = "increase" if prob_b >= threshold_b else "decrease"

        # Rule-based magnitude
        magnitude_pct = _rule_based_magnitude(direction, req, margin, popularity_pct, meta)

        delta     = round(req.current_price * (magnitude_pct / 100) * (1 if direction == "increase" else -1), 2)
        new_price = round(req.current_price + delta, 2)

        # Floor: never go below cost × 1.20
        cost_floor = round(req.cost_price * 1.20, 2)
        if new_price < cost_floor:
            new_price = cost_floor
            delta     = round(new_price - req.current_price, 2)

        return Engine3Response(
            success=True, change=True,
            direction=direction, delta=delta, new_price=new_price,
            quadrant=quadrant, quadrant_name=quadrant_name,
            prob_a=round(prob_a, 4),
            prob_b=round(prob_b, 4),
        )

    except Exception as e:
        logger.exception("Engine 3 prediction failed")
        return Engine3Response(success=False, error=str(e))
