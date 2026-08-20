# ─────────────────────────────────────────────────────────────────────────────
# schemas/engine1_schema.py — Request/Response for Dynamic Pricing
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel, Field
from typing import Optional


class Engine1Request(BaseModel):
    food_id: int
    item_name: str
    category: str
    cost_price: float = Field(gt=0)
    current_price: float = Field(gt=0)
    min_price: float = Field(gt=0)
    max_price: float = Field(gt=0)
    demand_1h: int = Field(ge=0, default=0)
    demand_24h: int = Field(ge=0, default=0)
    competitor_price_idx: float = Field(gt=0, default=1.0)
    time_of_day: int = Field(ge=0, le=23, default=12)


class Engine1Response(BaseModel):
    success: bool
    optimal_price: Optional[float] = None
    decision: Optional[str] = None   # "increase" | "decrease" | "hold"
    delta: Optional[float] = None
    error: Optional[str] = None
