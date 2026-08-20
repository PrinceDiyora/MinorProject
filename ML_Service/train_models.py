#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# train_models.py — Bootstrap trainer
#
# Generates synthetic training data and fits XGBoost models that produce
# ALL required .pkl artifacts for the 3 ML engines so app.py can start.
#
# Run from the ML_Service directory:
#   python train_models.py
# ─────────────────────────────────────────────────────────────────────────────
import json
import math
import random
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.preprocessing import LabelEncoder

# ── Paths ─────────────────────────────────────────────────────────────────────
ML_SERVICE_DIR = Path(__file__).resolve().parent
BASE_DIR       = ML_SERVICE_DIR.parent
ENGINE1_DIR    = BASE_DIR / "ML Models" / "engine1_export"
ENGINE2_DIR    = BASE_DIR / "ML Models" / "engine2_export"
ENGINE3_DIR    = BASE_DIR / "ML Models" / "engine3_export"

random.seed(42)
np.random.seed(42)

# ── Item / category catalogue (mirrors item_lookup.json exactly) ──────────────
ITEM_LOOKUP = {
    "Bhel Puri":            {"cat": "Street Food",  "cost": 15,  "price": 40},
    "Burger":               {"cat": "Fast Food",    "cost": 45,  "price": 120},
    "Chai":                 {"cat": "Beverage",     "cost": 5,   "price": 20},
    "Chole Bhature":        {"cat": "Traditional",  "cost": 35,  "price": 110},
    "Cold Coffee":          {"cat": "Beverage",     "cost": 15,  "price": 70},
    "Dabeli":               {"cat": "Street Food",  "cost": 12,  "price": 30},
    "Dal Makhani":          {"cat": "Traditional",  "cost": 40,  "price": 130},
    "Frankie":              {"cat": "Fast Food",    "cost": 35,  "price": 90},
    "Fries":                {"cat": "Fast Food",    "cost": 20,  "price": 80},
    "Garlic Bread":         {"cat": "Fast Food",    "cost": 25,  "price": 90},
    "Gulab Jamun":          {"cat": "Dessert",      "cost": 20,  "price": 60},
    "Ice Cream":            {"cat": "Dessert",      "cost": 25,  "price": 80},
    "Kheer":                {"cat": "Dessert",      "cost": 20,  "price": 65},
    "Kulfi":                {"cat": "Dessert",      "cost": 22,  "price": 70},
    "Lassi":                {"cat": "Beverage",     "cost": 18,  "price": 60},
    "Lemon Soda":           {"cat": "Beverage",     "cost": 8,   "price": 35},
    "Paneer Butter Masala": {"cat": "Traditional",  "cost": 70,  "price": 200},
    "Panipuri":             {"cat": "Street Food",  "cost": 8,   "price": 20},
    "Pizza":                {"cat": "Fast Food",    "cost": 85,  "price": 250},
    "Rajma Chawal":         {"cat": "Traditional",  "cost": 45,  "price": 140},
    "Roti":                 {"cat": "Traditional",  "cost": 5,   "price": 15},
    "Samosa":               {"cat": "Street Food",  "cost": 10,  "price": 20},
    "Sandwich":             {"cat": "Fast Food",    "cost": 30,  "price": 80},
    "Sev Puri":             {"cat": "Street Food",  "cost": 14,  "price": 35},
    "Thick Shake":          {"cat": "Beverage",     "cost": 30,  "price": 120},
    "Vadapav":              {"cat": "Street Food",  "cost": 10,  "price": 25},
    "Veg Thali":            {"cat": "Traditional",  "cost": 80,  "price": 220},
}

# Keys already sorted alphabetically — matches LabelEncoder output of sorted fit
ITEMS      = sorted(ITEM_LOOKUP.keys())
CATEGORIES = sorted({v["cat"] for v in ITEM_LOOKUP.values()})

SYNERGY = {
    "Burger||Fries": 0.95,   "Burger||Cold Coffee": 0.88, "Burger||Thick Shake": 0.85,
    "Burger||Garlic Bread": 0.70, "Burger||Lemon Soda": 0.65,
    "Pizza||Garlic Bread": 0.92,  "Pizza||Cold Coffee": 0.80, "Pizza||Thick Shake": 0.78,
    "Fries||Cold Coffee": 0.82,   "Fries||Thick Shake": 0.78,
    "Sandwich||Cold Coffee": 0.75, "Sandwich||Fries": 0.80,
    "Frankie||Lemon Soda": 0.78,  "Frankie||Cold Coffee": 0.72,
    "Panipuri||Sev Puri": 0.72,   "Panipuri||Bhel Puri": 0.68,
    "Vadapav||Chai": 0.90,        "Vadapav||Lemon Soda": 0.72,
    "Samosa||Chai": 0.88,         "Dabeli||Lemon Soda": 0.70,
    "Paneer Butter Masala||Roti": 0.95,  "Dal Makhani||Roti": 0.92,
    "Veg Thali||Lassi": 0.85,     "Chole Bhature||Lassi": 0.88,
    "Rajma Chawal||Lassi": 0.82,  "Paneer Butter Masala||Lassi": 0.78,
    "Dal Makhani||Lassi": 0.75,   "Veg Thali||Gulab Jamun": 0.80,
    "Paneer Butter Masala||Gulab Jamun": 0.72,
    "Rajma Chawal||Kheer": 0.75,  "Cold Coffee||Ice Cream": 0.78,
    "Cold Coffee||Kulfi": 0.72,   "Lassi||Gulab Jamun": 0.75,
    "Chai||Gulab Jamun": 0.80,    "Chai||Kheer": 0.78,
}


# ── Helpers ───────────────────────────────────────────────────────────────────
def cyc(val, period):
    a = 2 * math.pi * val / period
    return math.sin(a), math.cos(a)


def get_synergy(a, b):
    return SYNERGY.get(f"{a}||{b}", SYNERGY.get(f"{b}||{a}", 0.0))


def make_encoders():
    """Create LabelEncoders whose class order matches metadata item_classes / cat_classes."""
    le_item = LabelEncoder()
    le_item.fit(ITEMS)          # sorted → same order as metadata.json
    le_cat = LabelEncoder()
    le_cat.fit(CATEGORIES)      # sorted → same order as metadata.json
    return le_item, le_cat


# ═════════════════════════════════════════════════════════════════════════════
# ENGINE 1 — Dynamic Pricing (XGBoost Regressor)
#
# Missing files:  engine1_price_optimizer.pkl  le_item.pkl  le_cat.pkl
# Features (23):  see metadata.json "features"
# Target:         selling_price
# ═════════════════════════════════════════════════════════════════════════════
def build_engine1():
    print("\n[1/3] Training Engine 1 — Dynamic Pricing …")
    le_item, le_cat = make_encoders()

    E1_FEATURES = [
        "item_name_enc", "item_category_enc",
        "base_cost", "base_price",
        "gross_margin", "margin_pct", "cost_to_price_ratio",
        "hour_sin", "hour_cos", "dow_sin", "dow_cos",
        "month_sin", "month_cos",
        "is_weekend", "is_lunch_peak", "is_dinner_peak",
        "is_late_night", "is_payday_week",
        "competitor_price_idx", "comp_premium",
        "comp_above_us", "comp_below_us",
        "quantity_sold",
    ]

    rows = []
    for _ in range(8000):
        item = random.choice(ITEMS)
        info = ITEM_LOOKUP[item]

        base_cost  = info["cost"]  * random.uniform(0.85, 1.15)
        base_price = info["price"] * random.uniform(0.90, 1.10)

        gross_margin        = base_price - base_cost
        margin_pct          = gross_margin / base_price
        cost_to_price_ratio = base_cost / base_price

        hour  = random.randint(0, 23)
        dow   = random.randint(0, 6)
        month = random.randint(1, 12)
        hour_sin,  hour_cos  = cyc(hour,  24)
        dow_sin,   dow_cos   = cyc(dow,   7)
        month_sin, month_cos = cyc(month, 12)

        is_weekend     = int(dow >= 5)
        is_lunch_peak  = int(11 <= hour <= 14)
        is_dinner_peak = int(19 <= hour <= 22)
        is_late_night  = int(hour >= 23 or hour <= 4)
        is_payday_week = int(random.randint(1, 30) >= 25)

        comp_idx      = random.uniform(0.70, 1.40)
        comp_premium  = base_price * comp_idx - base_price
        comp_above_us = int(comp_idx > 1.0)
        comp_below_us = int(comp_idx < 1.0)
        qty_sold      = random.randint(0, 80)

        # Synthetic target: base_price adjusted by demand & competitor signal
        demand_factor = 1.0 + (qty_sold / 80) * 0.10
        comp_factor   = 1.0 + (comp_idx - 1.0) * 0.15
        selling_price = base_price * demand_factor * comp_factor
        selling_price *= (1.0 + random.gauss(0, 0.02))
        selling_price = max(base_cost * 1.20, min(base_price * 1.60, selling_price))

        rows.append({
            "item_name_enc":        le_item.transform([item])[0],
            "item_category_enc":    le_cat.transform([info["cat"]])[0],
            "base_cost":            base_cost,
            "base_price":           base_price,
            "gross_margin":         gross_margin,
            "margin_pct":           margin_pct,
            "cost_to_price_ratio":  cost_to_price_ratio,
            "hour_sin":             hour_sin,
            "hour_cos":             hour_cos,
            "dow_sin":              dow_sin,
            "dow_cos":              dow_cos,
            "month_sin":            month_sin,
            "month_cos":            month_cos,
            "is_weekend":           is_weekend,
            "is_lunch_peak":        is_lunch_peak,
            "is_dinner_peak":       is_dinner_peak,
            "is_late_night":        is_late_night,
            "is_payday_week":       is_payday_week,
            "competitor_price_idx": comp_idx,
            "comp_premium":         comp_premium,
            "comp_above_us":        comp_above_us,
            "comp_below_us":        comp_below_us,
            "quantity_sold":        qty_sold,
            "__y__":                selling_price,
        })

    df = pd.DataFrame(rows)
    X  = df[E1_FEATURES]
    y  = df["__y__"]

    model = xgb.XGBRegressor(
        n_estimators=300, max_depth=7, learning_rate=0.04,
        subsample=0.8, colsample_bytree=0.85, min_child_weight=5,
        gamma=1.0, reg_alpha=0.01, reg_lambda=1.0,
        objective="reg:squarederror", tree_method="hist",
        random_state=42, n_jobs=-1,
    )
    model.fit(X, y, verbose=False)

    joblib.dump(model,   ENGINE1_DIR / "engine1_price_optimizer.pkl")
    joblib.dump(le_item, ENGINE1_DIR / "le_item.pkl")
    joblib.dump(le_cat,  ENGINE1_DIR / "le_cat.pkl")
    print(f"  ✓ Saved: engine1_price_optimizer.pkl  le_item.pkl  le_cat.pkl")
    print(f"     → {ENGINE1_DIR}")


# ═════════════════════════════════════════════════════════════════════════════
# ENGINE 2 — Upsell Classifier (XGBoost Classifier)
#
# Missing files:  engine2_upsell_classifier.pkl  le_item.pkl  le_cat.pkl
# Features (33):  see metadata.json "features"
# Target:         upsell_accepted  (binary)
# ═════════════════════════════════════════════════════════════════════════════
def build_engine2():
    print("\n[2/3] Training Engine 2 — Upsell Classifier …")
    le_item, le_cat = make_encoders()

    E2_FEATURES = [
        "anchor_item_enc", "anchor_cat_enc",
        "upsell_item_enc", "upsell_cat_enc",
        "same_category",
        "price_ratio", "log_price_ratio",
        "is_cheap_addon", "is_very_cheap", "is_expensive_addon",
        "synergy_score", "synergy_sq", "synergy_x_cheap",
        "discount_percent", "discounted_price", "discount_savings_inr",
        "discount_vs_margin", "synergy_x_discount", "synergy_x_margin",
        "anchor_base_price", "upsell_base_price", "upsell_base_cost",
        "upsell_margin_pct", "upsell_gross_margin", "discounted_margin_pct",
        "order_size", "is_weekend", "hour_of_day",
        "hour_sin", "hour_cos", "is_peak",
        "competitor_price_idx", "comp_premium",
    ]

    rows = []
    attempts = 0
    while len(rows) < 10000 and attempts < 30000:
        attempts += 1
        anchor = random.choice(ITEMS)
        upsell = random.choice(ITEMS)
        if anchor == upsell:
            continue

        ai = ITEM_LOOKUP[anchor]
        ui = ITEM_LOOKUP[upsell]

        anchor_price = ai["price"] * random.uniform(0.88, 1.12)
        upsell_price = ui["price"] * random.uniform(0.88, 1.12)
        upsell_cost  = ui["cost"]  * random.uniform(0.88, 1.12)

        synergy          = get_synergy(anchor, upsell)
        price_ratio      = upsell_price / anchor_price if anchor_price > 0 else 1.0
        log_price_ratio  = math.log(max(price_ratio, 1e-6))
        is_cheap_addon   = int(price_ratio < 0.5)
        is_very_cheap    = int(price_ratio < 0.25)
        is_expensive_addon = int(price_ratio > 1.5)
        synergy_sq       = synergy ** 2
        synergy_x_cheap  = synergy * is_cheap_addon

        discount_percent      = min(synergy * 10.0, 15.0)
        discounted_price      = round(upsell_price * (1 - discount_percent / 100), 2)
        discount_savings_inr  = upsell_price - discounted_price
        upsell_gross_margin   = upsell_price - upsell_cost
        upsell_margin_pct     = upsell_gross_margin / upsell_price if upsell_price > 0 else 0.0
        discount_vs_margin    = (discount_savings_inr / upsell_gross_margin
                                 if upsell_gross_margin > 0 else 0.0)
        discounted_margin_pct = ((discounted_price - upsell_cost) / discounted_price
                                 if discounted_price > 0 else 0.0)
        synergy_x_discount    = synergy * discount_percent
        synergy_x_margin      = synergy * upsell_margin_pct
        same_category         = int(ai["cat"] == ui["cat"])

        hour       = random.randint(0, 23)
        dow        = random.randint(0, 6)
        is_weekend = int(dow >= 5)
        hour_sin, hour_cos = cyc(hour, 24)
        is_peak    = int(11 <= hour <= 14 or 19 <= hour <= 22)
        order_size = random.randint(1, 6)
        comp_idx   = random.uniform(0.80, 1.30)
        comp_premium = anchor_price * comp_idx - anchor_price

        # Synthetic target — accept if high synergy or cheap add-on
        p = (synergy * 0.65
             + is_cheap_addon * 0.18
             + is_peak * 0.07
             + same_category * 0.05)
        p += random.gauss(0, 0.10)
        upsell_accepted = int(p > 0.45)

        rows.append({
            "anchor_item_enc":     le_item.transform([anchor])[0],
            "anchor_cat_enc":      le_cat.transform([ai["cat"]])[0],
            "upsell_item_enc":     le_item.transform([upsell])[0],
            "upsell_cat_enc":      le_cat.transform([ui["cat"]])[0],
            "same_category":       same_category,
            "price_ratio":         price_ratio,
            "log_price_ratio":     log_price_ratio,
            "is_cheap_addon":      is_cheap_addon,
            "is_very_cheap":       is_very_cheap,
            "is_expensive_addon":  is_expensive_addon,
            "synergy_score":       synergy,
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
            "hour_of_day":         hour,
            "hour_sin":            hour_sin,
            "hour_cos":            hour_cos,
            "is_peak":             is_peak,
            "competitor_price_idx": comp_idx,
            "comp_premium":        comp_premium,
            "__y__":               upsell_accepted,
        })

    df = pd.DataFrame(rows)
    X  = df[E2_FEATURES]
    y  = df["__y__"]

    pos_weight = (y == 0).sum() / max((y == 1).sum(), 1)
    model = xgb.XGBClassifier(
        n_estimators=250, max_depth=5, learning_rate=0.04,
        subsample=0.80, colsample_bytree=0.80,
        min_child_weight=4, gamma=2.0,
        reg_alpha=0.005, reg_lambda=2.0,
        scale_pos_weight=float(pos_weight),
        objective="binary:logistic", tree_method="hist",
        eval_metric="auc", random_state=42, n_jobs=-1,
    )
    model.fit(X, y, verbose=False)

    joblib.dump(model,   ENGINE2_DIR / "engine2_upsell_classifier.pkl")
    joblib.dump(le_item, ENGINE2_DIR / "le_item.pkl")
    joblib.dump(le_cat,  ENGINE2_DIR / "le_cat.pkl")
    print(f"  ✓ Saved: engine2_upsell_classifier.pkl  le_item.pkl  le_cat.pkl")
    print(f"     → {ENGINE2_DIR}")


# ═════════════════════════════════════════════════════════════════════════════
# ENGINE 3 — Strategic Pricing  (3 XGBoost models: A, B, C)
#
# Missing files:  model_A.pkl  model_B.pkl  model_C.pkl  le_item.pkl  le_cat.pkl
# Features (36):  see metadata.json "features"
# Targets:
#   A — should_change_price  (binary classifier)
#   B — direction            (binary classifier: 1=increase, 0=decrease)
#   C — magnitude_%          (regressor — intentionally weak, R²≈-3 is OK)
# ═════════════════════════════════════════════════════════════════════════════
def build_engine3():
    print("\n[3/3] Training Engine 3 — Strategic Pricing …")
    le_item, le_cat = make_encoders()

    E3_FEATURES = [
        "item_name_enc", "item_category_enc",
        "item_avg_margin", "item_avg_popularity", "margin_x_popularity",
        "quadrant", "is_star", "is_puzzle", "is_dog", "is_plowhorse",
        "margin_pct", "gross_margin", "cost_ratio", "margin_headroom",
        "popularity_pct",
        "rolling_7d_qty", "popularity_momentum",
        "quantity_sold", "base_cost", "base_price", "price_vs_cost_ratio",
        "competitor_price_idx", "comp_premium", "comp_above_us", "comp_below_us",
        "hour_sin", "hour_cos", "dow_sin", "dow_cos",
        "month_sin", "month_cos",
        "is_weekend", "is_lunch_peak", "is_dinner_peak",
        "is_late_night", "is_payday_week",
    ]

    POP_MED    = 0.5011
    MARGIN_MED = 0.6667

    rows = []
    for _ in range(10000):
        item = random.choice(ITEMS)
        info = ITEM_LOOKUP[item]

        base_cost  = info["cost"]  * random.uniform(0.85, 1.15)
        base_price = info["price"] * random.uniform(0.90, 1.10)

        margin_pct   = (base_price - base_cost) / base_price
        gross_margin = base_price - base_cost
        cost_ratio   = base_cost / base_price

        item_avg_margin     = margin_pct * random.uniform(0.88, 1.12)
        quantity_sold       = random.randint(1, 100)
        popularity_pct      = quantity_sold / 100.0
        item_avg_popularity = popularity_pct * random.uniform(0.80, 1.20)
        margin_x_popularity = item_avg_margin * item_avg_popularity
        margin_headroom     = item_avg_margin - 0.30

        high_margin = item_avg_margin >= MARGIN_MED
        high_pop    = item_avg_popularity >= POP_MED
        if high_margin and not high_pop:        q = 0  # Stars
        elif high_margin and high_pop:          q = 1  # Puzzles
        elif not high_margin and not high_pop:  q = 2  # Dogs
        else:                                   q = 3  # Plowhorses
        is_star, is_puzzle, is_dog, is_plowhorse = (
            int(q == 0), int(q == 1), int(q == 2), int(q == 3)
        )

        rolling_7d_qty      = quantity_sold * 7 + random.randint(-30, 30)
        popularity_momentum = random.uniform(-0.30, 0.30)
        price_vs_cost_ratio = base_price / base_cost if base_cost > 0 else 2.0

        comp_idx      = random.uniform(0.70, 1.40)
        comp_premium  = base_price * comp_idx - base_price
        comp_above_us = int(comp_idx > 1.0)
        comp_below_us = int(comp_idx < 1.0)

        hour  = random.randint(0, 23)
        dow   = random.randint(0, 6)
        month = random.randint(1, 12)
        hour_sin,  hour_cos  = cyc(hour,  24)
        dow_sin,   dow_cos   = cyc(dow,   7)
        month_sin, month_cos = cyc(month, 12)
        is_weekend     = int(dow >= 5)
        is_lunch_peak  = int(11 <= hour <= 14)
        is_dinner_peak = int(19 <= hour <= 22)
        is_late_night  = int(hour >= 23 or hour <= 4)
        is_payday_week = int(random.randint(1, 30) >= 25)

        # ── Synthetic targets ─────────────────────────────────────────────────
        # A: should_change — driven by how far item is from "ideal" position
        margin_dev = abs(item_avg_margin - MARGIN_MED)
        demand_dev = abs(item_avg_popularity - POP_MED)
        should_change = int(
            (margin_dev > 0.08 or demand_dev > 0.18 or q == 3)
            and random.random() > 0.28
        )

        # B: direction — Plowhorses go up; Stars go down; others by competitor
        if q == 3:                      go_up = 1   # Plowhorse: price inelastic → raise
        elif q == 0:                    go_up = 0   # Star: push volume → discount
        elif comp_idx > 1.05:           go_up = 1   # Competitor above us → raise
        else:                           go_up = int(random.random() > 0.45)
        go_up = int(go_up * (random.random() > 0.08))  # 8% flip for noise

        # C: magnitude % (we keep this weak on purpose — engine uses rule-based override)
        magnitude = 5.0 + margin_dev * 20 + demand_dev * 15 + random.gauss(0, 3)
        magnitude = float(max(2.0, min(30.0, magnitude)))

        rows.append({
            "item_name_enc":      le_item.transform([item])[0],
            "item_category_enc":  le_cat.transform([info["cat"]])[0],
            "item_avg_margin":    item_avg_margin,
            "item_avg_popularity": item_avg_popularity,
            "margin_x_popularity": margin_x_popularity,
            "quadrant":           q,
            "is_star":            is_star,
            "is_puzzle":          is_puzzle,
            "is_dog":             is_dog,
            "is_plowhorse":       is_plowhorse,
            "margin_pct":         margin_pct,
            "gross_margin":       gross_margin,
            "cost_ratio":         cost_ratio,
            "margin_headroom":    margin_headroom,
            "popularity_pct":     popularity_pct,
            "rolling_7d_qty":     rolling_7d_qty,
            "popularity_momentum": popularity_momentum,
            "quantity_sold":      quantity_sold,
            "base_cost":          base_cost,
            "base_price":         base_price,
            "price_vs_cost_ratio": price_vs_cost_ratio,
            "competitor_price_idx": comp_idx,
            "comp_premium":       comp_premium,
            "comp_above_us":      comp_above_us,
            "comp_below_us":      comp_below_us,
            "hour_sin":           hour_sin,
            "hour_cos":           hour_cos,
            "dow_sin":            dow_sin,
            "dow_cos":            dow_cos,
            "month_sin":          month_sin,
            "month_cos":          month_cos,
            "is_weekend":         is_weekend,
            "is_lunch_peak":      is_lunch_peak,
            "is_dinner_peak":     is_dinner_peak,
            "is_late_night":      is_late_night,
            "is_payday_week":     is_payday_week,
            "__y_a__":            should_change,
            "__y_b__":            go_up,
            "__y_c__":            magnitude,
        })

    df = pd.DataFrame(rows)
    X  = df[E3_FEATURES]

    # Model A — should_change_price?
    model_a = xgb.XGBClassifier(
        n_estimators=150, max_depth=5, learning_rate=0.05,
        subsample=0.80, colsample_bytree=0.80,
        min_child_weight=4, gamma=1.5,
        objective="binary:logistic", tree_method="hist",
        eval_metric="auc", random_state=42, n_jobs=-1,
    )
    model_a.fit(X, df["__y_a__"], verbose=False)

    # Model B — direction (increase vs decrease)?
    model_b = xgb.XGBClassifier(
        n_estimators=80, max_depth=4, learning_rate=0.05,
        subsample=0.80, colsample_bytree=0.80,
        objective="binary:logistic", tree_method="hist",
        eval_metric="auc", random_state=42, n_jobs=-1,
    )
    model_b.fit(X, df["__y_b__"], verbose=False)

    # Model C — magnitude regressor (intentionally weak; engine uses rule-based override)
    model_c = xgb.XGBRegressor(
        n_estimators=1, max_depth=2, learning_rate=0.10,
        objective="reg:squarederror", tree_method="hist",
        random_state=42,
    )
    model_c.fit(X, df["__y_c__"], verbose=False)

    joblib.dump(model_a, ENGINE3_DIR / "model_A.pkl")
    joblib.dump(model_b, ENGINE3_DIR / "model_B.pkl")
    joblib.dump(model_c, ENGINE3_DIR / "model_C.pkl")
    joblib.dump(le_item, ENGINE3_DIR / "le_item.pkl")
    joblib.dump(le_cat,  ENGINE3_DIR / "le_cat.pkl")
    print("  ✓ Saved: model_A.pkl  model_B.pkl  model_C.pkl  le_item.pkl  le_cat.pkl")
    print(f"     → {ENGINE3_DIR}")


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 62)
    print("  ML Bootstrap Trainer — generating all .pkl artifacts")
    print("=" * 62)

    try:
        build_engine1()
        build_engine2()
        build_engine3()
    except Exception as exc:
        print(f"\n❌ Training failed: {exc}", file=sys.stderr)
        raise

    print("\n" + "=" * 62)
    print("  ✅ Done — 9 .pkl files written across 3 export directories.")
    print("     You can now start the ML service:  python app.py")
    print("=" * 62)
