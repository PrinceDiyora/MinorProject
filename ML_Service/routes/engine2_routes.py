# ─────────────────────────────────────────────────────────────────────────────
# routes/engine2_routes.py — POST /engine2/upsell
# ─────────────────────────────────────────────────────────────────────────────
from fastapi import APIRouter
from schemas.engine2_schema import Engine2Request, Engine2Response
from engines.engine2 import predict_upsell

router = APIRouter(prefix="/engine2", tags=["Engine 2 — Upsell Recommendation"])


@router.post("/upsell", response_model=Engine2Response)
async def upsell_recommendation(request: Engine2Request):
    """Recommend an upsell item for the given cart."""
    return predict_upsell(request)
