# ─────────────────────────────────────────────────────────────────────────────
# routes/engine1_routes.py — POST /engine1/price
# ─────────────────────────────────────────────────────────────────────────────
from fastapi import APIRouter
from schemas.engine1_schema import Engine1Request, Engine1Response
from engines.engine1 import predict_price

router = APIRouter(prefix="/engine1", tags=["Engine 1 — Dynamic Pricing"])


@router.post("/price", response_model=Engine1Response)
async def dynamic_price(request: Engine1Request):
    """Predict optimal selling price for a food item."""
    return predict_price(request)
