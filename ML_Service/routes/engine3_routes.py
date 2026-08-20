# ─────────────────────────────────────────────────────────────────────────────
# routes/engine3_routes.py — POST /engine3/optimize
# ─────────────────────────────────────────────────────────────────────────────
from fastapi import APIRouter
from schemas.engine3_schema import Engine3Request, Engine3Response
from engines.engine3 import predict_optimization

router = APIRouter(prefix="/engine3", tags=["Engine 3 — Strategic Pricing"])


@router.post("/optimize", response_model=Engine3Response)
async def strategic_pricing(request: Engine3Request):
    """Run three-stage strategic pricing optimization for a food item.

    Pass max_demand_7d = max demand across all items in your batch so that
    popularity_pct is normalised correctly (relative to the batch).
    """
    return predict_optimization(request, max_demand_7d=request.max_demand_7d)
