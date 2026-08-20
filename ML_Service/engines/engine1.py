# ─────────────────────────────────────────────────────────────────────────────
# engines/engine1.py — Dynamic Pricing Inference
#
# Model: XGBoost regressor  →  predicts optimal selling_price
# Features: 22 columns (see metadata.json "features" list)
# ─────────────────────────────────────────────────────────────────────────────
import numpy as np
import pandas as pd
import logging

from models.model_loader import model_store
from schemas.engine1_schema import Engine1Request, Engine1Response
from utils.encoders import safe_label_encode
from utils.preprocessing import (
    compute_margin_features,
    compute_time_features,
    compute_competitor_features,
)

logger = logging.getLogger("ml_service")


def predict_price(req: Engine1Request) -> Engine1Response:
    """Run Engine 1 dynamic pricing inference.

    Returns optimal_price clamped to [min_price, max_price],
    the decision (increase/decrease/hold), and the delta.
    """
    try:
        store = model_store

        # ── Encode categoricals ──────────────────────────────────────────────
        item_name_enc    = safe_label_encode(store.e1_le_item, req.item_name)
        item_category_enc = safe_label_encode(store.e1_le_cat, req.category)

        # ── Margin features ──────────────────────────────────────────────────
        margin = compute_margin_features(req.cost_price, req.current_price)

        # ── Time features ────────────────────────────────────────────────────
        time_feats = compute_time_features(req.time_of_day)

        # ── Competitor features ──────────────────────────────────────────────
        comp = compute_competitor_features(req.competitor_price_idx, req.current_price)

        # ── Build feature vector (must match metadata.json order exactly) ────
        features = {
            "item_name_enc":       item_name_enc,
            "item_category_enc":   item_category_enc,
            "base_cost":           req.cost_price,
            "base_price":          req.current_price,
            "gross_margin":        margin["gross_margin"],
            "margin_pct":          margin["margin_pct"],
            "cost_to_price_ratio": margin["cost_to_price_ratio"],
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
            "competitor_price_idx": req.competitor_price_idx,
            "comp_premium":        comp["comp_premium"],
            "comp_above_us":       comp["comp_above_us"],
            "comp_below_us":       comp["comp_below_us"],
            "quantity_sold":       req.demand_24h,
        }

        # ── Predict ──────────────────────────────────────────────────────────
        feature_names = store.e1_meta["features"]
        X = pd.DataFrame([features])[feature_names]

        raw_prediction = float(store.e1_model.predict(X)[0])

        # ── Clamp to [min_price, max_price] ──────────────────────────────────
        optimal_price = round(
            max(req.min_price, min(req.max_price, raw_prediction)), 2
        )

        # ── Decision + delta ─────────────────────────────────────────────────
        delta = round(optimal_price - req.current_price, 2)
        if delta > 0.5:
            decision = "increase"
        elif delta < -0.5:
            decision = "decrease"
        else:
            decision = "hold"

        return Engine1Response(
            success=True,
            optimal_price=optimal_price,
            decision=decision,
            delta=delta,
        )

    except Exception as e:
        logger.exception("Engine 1 prediction failed")
        return Engine1Response(success=False, error=str(e))
