# ─────────────────────────────────────────────────────────────────────────────
# schemas/engine2_schema.py — Request/Response for Upsell Recommendation
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel, Field
from typing import List, Optional


class Engine2Request(BaseModel):
    items: List[str]                          # list of item names in the cart
    order_value: float = Field(ge=0, default=0)
    time_of_day: int = Field(ge=0, le=23, default=12)


class Engine2Response(BaseModel):
    success: bool
    upsell_food_id: Optional[int] = None
    upsell_item_name: Optional[str] = None
    synergy_score: Optional[float] = None
    recommended_discount: Optional[float] = None
    error: Optional[str] = None
