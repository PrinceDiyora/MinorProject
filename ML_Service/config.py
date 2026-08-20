# ─────────────────────────────────────────────────────────────────────────────
# config.py — Paths, constants, and service configuration
# ─────────────────────────────────────────────────────────────────────────────
import os
from pathlib import Path

# ── Directories ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent          # HackaMined/
MODEL_DIR = BASE_DIR / "ML_Models"
if not MODEL_DIR.exists():
    MODEL_DIR = BASE_DIR / "ML Models"

ENGINE1_DIR = MODEL_DIR / "engine1_export"
ENGINE2_DIR = MODEL_DIR / "engine2_export"
ENGINE3_DIR = MODEL_DIR / "engine3_export"

# ── Service ──────────────────────────────────────────────────────────────────
SERVICE_PORT = int(os.getenv("ML_SERVICE_PORT", 5000))
SERVICE_HOST = os.getenv("ML_SERVICE_HOST", "0.0.0.0")
CORS_ORIGINS = os.getenv(
    "ML_CORS_ORIGINS",
    "http://localhost:8000,http://localhost:5173,http://localhost:5174",
).split(",")

# ── Business rules (from metadata.json schema_alignment) ────────────────────
MARGIN_FLOOR_MULTIPLIER = 1.20      # min_price >= cost_price * 1.20
CEILING_MULTIPLIER      = 1.60      # max_price <= base_price * 1.60
MAX_UPSELL_DISCOUNT_PCT = 15.0      # Engine 2 cap
MAX_STRATEGIC_CHANGE_PCT = 30.0     # Engine 3 cap
