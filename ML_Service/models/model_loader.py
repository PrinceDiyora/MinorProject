# ─────────────────────────────────────────────────────────────────────────────
# models/model_loader.py — Load all ML models at startup
# ─────────────────────────────────────────────────────────────────────────────
import json
import joblib
import logging
from config import ENGINE1_DIR, ENGINE2_DIR, ENGINE3_DIR

logger = logging.getLogger("ml_service")


class ModelStore:
    """Singleton-style container for all loaded ML artifacts."""

    def __init__(self):
        # Engine 1 — Dynamic Pricing
        self.e1_model = None
        self.e1_le_item = None
        self.e1_le_cat = None
        self.e1_meta = None

        # Engine 2 — Upsell Recommendation
        self.e2_model = None
        self.e2_le_item = None
        self.e2_le_cat = None
        self.e2_meta = None
        self.e2_synergy = None
        self.e2_item_lookup = None

        # Engine 3 — Strategic Pricing
        self.e3_model_a = None
        self.e3_model_b = None
        self.e3_model_c = None
        self.e3_le_item = None
        self.e3_le_cat = None
        self.e3_meta = None

    def load_all(self):
        """Load every model artifact from disk. Call once during app startup."""
        logger.info("Loading Engine 1 models …")
        self._load_engine1()
        logger.info("Loading Engine 2 models …")
        self._load_engine2()
        logger.info("Loading Engine 3 models …")
        self._load_engine3()
        logger.info("All models loaded successfully ✓")

    # ── Engine 1 ─────────────────────────────────────────────────────────────
    def _load_engine1(self):
        self.e1_model   = joblib.load(ENGINE1_DIR / "engine1_price_optimizer.pkl")
        self.e1_le_item = joblib.load(ENGINE1_DIR / "le_item.pkl")
        self.e1_le_cat  = joblib.load(ENGINE1_DIR / "le_cat.pkl")
        with open(ENGINE1_DIR / "metadata.json", "r") as f:
            self.e1_meta = json.load(f)

    # ── Engine 2 ─────────────────────────────────────────────────────────────
    def _load_engine2(self):
        self.e2_model   = joblib.load(ENGINE2_DIR / "engine2_upsell_classifier.pkl")
        self.e2_le_item = joblib.load(ENGINE2_DIR / "le_item.pkl")
        self.e2_le_cat  = joblib.load(ENGINE2_DIR / "le_cat.pkl")
        with open(ENGINE2_DIR / "metadata.json", "r") as f:
            self.e2_meta = json.load(f)
        with open(ENGINE2_DIR / "synergy_matrix.json", "r") as f:
            self.e2_synergy = json.load(f)
        with open(ENGINE2_DIR / "item_lookup.json", "r") as f:
            self.e2_item_lookup = json.load(f)

    # ── Engine 3 ─────────────────────────────────────────────────────────────
    def _load_engine3(self):
        self.e3_model_a = joblib.load(ENGINE3_DIR / "model_A.pkl")
        self.e3_model_b = joblib.load(ENGINE3_DIR / "model_B.pkl")
        self.e3_model_c = joblib.load(ENGINE3_DIR / "model_C.pkl")
        self.e3_le_item = joblib.load(ENGINE3_DIR / "le_item.pkl")
        self.e3_le_cat  = joblib.load(ENGINE3_DIR / "le_cat.pkl")
        with open(ENGINE3_DIR / "metadata.json", "r") as f:
            self.e3_meta = json.load(f)


# Global instance — populated during app lifespan
model_store = ModelStore()
