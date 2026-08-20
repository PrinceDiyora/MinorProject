# ─────────────────────────────────────────────────────────────────────────────
# engines/engine2.py — Upsell Recommendation Inference
#
# Model: XGBoost classifier  →  predict P(upsell_accepted)
# Strategy: for each cart item, find synergy candidates, score each pair
#           with the classifier, return best candidate above threshold.
# ─────────────────────────────────────────────────────────────────────────────
import math
import numpy as np
import pandas as pd
import logging

from models.model_loader import model_store
from schemas.engine2_schema import Engine2Request, Engine2Response
from utils.encoders import safe_label_encode, cyclical_encode
from config import MAX_UPSELL_DISCOUNT_PCT

logger = logging.getLogger("ml_service")


def _get_synergy(item_a: str, item_b: str, synergy_map: dict) -> float:
    """Look up synergy score for a pair (order-independent)."""
    key1 = f"{item_a}||{item_b}"
    key2 = f"{item_b}||{item_a}"
    return synergy_map.get(key1, synergy_map.get(key2, 0.0))


def _build_candidate_features(
    anchor_name: str,
    upsell_name: str,
    synergy_score: float,
    order_value: float,
    order_size: int,
    time_of_day: int,
    item_lookup: dict,
    le_item,
    le_cat,
    meta: dict,
) -> dict | None:
    """Build the 33-feature vector for one (anchor, upsell) pair."""
    anchor_info = item_lookup.get(anchor_name)
    upsell_info = item_lookup.get(upsell_name)
    if not anchor_info or not upsell_info:
        return None

    anchor_item_enc = safe_label_encode(le_item, anchor_name)
    anchor_cat_enc  = safe_label_encode(le_cat, anchor_info["cat"])
    upsell_item_enc = safe_label_encode(le_item, upsell_name)
    upsell_cat_enc  = safe_label_encode(le_cat, upsell_info["cat"])

    same_category = int(anchor_info["cat"] == upsell_info["cat"])

    anchor_price = anchor_info["price"]
    upsell_price = upsell_info["price"]
    upsell_cost  = upsell_info["cost"]

    price_ratio = upsell_price / anchor_price if anchor_price > 0 else 1.0
    log_price_ratio = math.log(price_ratio) if price_ratio > 0 else 0.0
    is_cheap_addon = int(price_ratio < 0.5)
    is_very_cheap  = int(price_ratio < 0.25)
    is_expensive_addon = int(price_ratio > 1.5)

    synergy_sq = synergy_score ** 2
    synergy_x_cheap = synergy_score * is_cheap_addon

    # Discount calculation (conservative: synergy-proportional, capped at 15%)
    discount_percent = min(synergy_score * 10.0, MAX_UPSELL_DISCOUNT_PCT)
    discounted_price = round(upsell_price * (1 - discount_percent / 100), 2)
    discount_savings_inr = upsell_price - discounted_price

    upsell_gross_margin = upsell_price - upsell_cost
    upsell_margin_pct = upsell_gross_margin / upsell_price if upsell_price > 0 else 0.0
    discount_vs_margin = discount_savings_inr / upsell_gross_margin if upsell_gross_margin > 0 else 0.0
    discounted_margin_pct = (discounted_price - upsell_cost) / discounted_price if discounted_price > 0 else 0.0

    synergy_x_discount = synergy_score * discount_percent
    synergy_x_margin   = synergy_score * upsell_margin_pct

    # Time features
    from datetime import datetime
    now = datetime.now()
    is_weekend = int(now.weekday() >= 5)
    hour_sin, hour_cos = cyclical_encode(time_of_day, 24)
    is_peak = int(11 <= time_of_day <= 14 or 19 <= time_of_day <= 22)

    # Competitor (default neutral)
    competitor_price_idx = 1.0
    comp_premium = 0.0

    return {
        "anchor_item_enc":     anchor_item_enc,
        "anchor_cat_enc":      anchor_cat_enc,
        "upsell_item_enc":     upsell_item_enc,
        "upsell_cat_enc":      upsell_cat_enc,
        "same_category":       same_category,
        "price_ratio":         price_ratio,
        "log_price_ratio":     log_price_ratio,
        "is_cheap_addon":      is_cheap_addon,
        "is_very_cheap":       is_very_cheap,
        "is_expensive_addon":  is_expensive_addon,
        "synergy_score":       synergy_score,
        "synergy_sq":          synergy_sq,
        "synergy_x_cheap":     synergy_x_cheap,
        "discount_percent":    discount_percent,
        "discounted_price":    discounted_price,
        "discount_savings_inr": discount_savings_inr,
        "discount_vs_margin":  discount_vs_margin,
        "synergy_x_discount":  synergy_x_discount,
        "synergy_x_margin":    synergy_x_margin,
        "anchor_base_price":   anchor_price,
        "upsell_base_price":   upsell_price,
        "upsell_base_cost":    upsell_cost,
        "upsell_margin_pct":   upsell_margin_pct,
        "upsell_gross_margin": upsell_gross_margin,
        "discounted_margin_pct": discounted_margin_pct,
        "order_size":          order_size,
        "is_weekend":          is_weekend,
        "hour_of_day":         time_of_day,
        "hour_sin":            hour_sin,
        "hour_cos":            hour_cos,
        "is_peak":             is_peak,
        "competitor_price_idx": competitor_price_idx,
        "comp_premium":        comp_premium,
    }


def predict_upsell(req: Engine2Request) -> Engine2Response:
    """Run Engine 2 upsell inference.

    For each cart item, finds synergy candidates, scores them with the
    XGBoost classifier, and returns the best candidate above threshold.
    """
    try:
        store = model_store
        synergy_map  = store.e2_synergy
        item_lookup  = store.e2_item_lookup
        threshold    = store.e2_meta.get("production_threshold", 0.52)
        feature_names = store.e2_meta["features"]
        cart_items    = req.items
        cart_set      = set(cart_items)

        # ── Collect all (anchor, candidate) pairs with synergy ────────────────
        candidates = []

        for anchor_name in cart_items:
            # Find all synergy partners for this anchor
            for key, syn_score in synergy_map.items():
                parts = key.split("||")
                if len(parts) != 2:
                    continue
                if anchor_name in parts:
                    partner = parts[0] if parts[1] == anchor_name else parts[1]
                    # Skip if partner is already in cart
                    if partner in cart_set:
                        continue
                    candidates.append((anchor_name, partner, syn_score))

        if not candidates:
            return Engine2Response(
                success=True,
                upsell_food_id=None,
                upsell_item_name=None,
                synergy_score=None,
                recommended_discount=None,
            )

        # ── Build feature matrix ─────────────────────────────────────────────
        feature_rows = []
        valid_candidates = []

        for anchor_name, upsell_name, syn_score in candidates:
            feats = _build_candidate_features(
                anchor_name=anchor_name,
                upsell_name=upsell_name,
                synergy_score=syn_score,
                order_value=req.order_value,
                order_size=len(cart_items),
                time_of_day=req.time_of_day,
                item_lookup=item_lookup,
                le_item=store.e2_le_item,
                le_cat=store.e2_le_cat,
                meta=store.e2_meta,
            )
            if feats is not None:
                feature_rows.append(feats)
                valid_candidates.append((anchor_name, upsell_name, syn_score))

        if not feature_rows:
            return Engine2Response(
                success=True,
                upsell_food_id=None,
                upsell_item_name=None,
                synergy_score=None,
                recommended_discount=None,
            )

        X = pd.DataFrame(feature_rows)[feature_names]

        # ── Predict probabilities ────────────────────────────────────────────
        probs = store.e2_model.predict_proba(X)[:, 1]   # P(accepted)

        # ── Select best candidate above threshold ────────────────────────────
        best_idx = int(np.argmax(probs))
        best_prob = float(probs[best_idx])

        if best_prob < threshold:
            return Engine2Response(
                success=True,
                upsell_food_id=None,
                upsell_item_name=None,
                synergy_score=None,
                recommended_discount=None,
            )

        _, best_upsell_name, best_synergy = valid_candidates[best_idx]
        upsell_info = item_lookup.get(best_upsell_name, {})

        # Compute recommended discount (synergy-proportional, capped)
        recommended_discount = round(
            min(best_synergy * 10.0, MAX_UPSELL_DISCOUNT_PCT), 2
        )

        # Try to find the encoded item id (label encoder index as proxy food_id)
        upsell_food_id = safe_label_encode(store.e2_le_item, best_upsell_name)

        return Engine2Response(
            success=True,
            upsell_food_id=upsell_food_id,
            upsell_item_name=best_upsell_name,
            synergy_score=round(best_synergy, 3),
            recommended_discount=recommended_discount,
        )

    except Exception as e:
        logger.exception("Engine 2 prediction failed")
        return Engine2Response(success=False, error=str(e))
