# ─────────────────────────────────────────────────────────────────────────────
# schemas/engine3_schema.py — Request/Response for Strategic Pricing
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel, Field
from typing import Optional


class Engine3Request(BaseModel):
    food_id: int
    item_name: str
    category: str
    cost_price: float = Field(gt=0)
    current_price: float = Field(gt=0)
    demand_7d: int = Field(ge=0, default=0)
    avg_margin: float = Field(ge=0, default=0.5)
    competitor_price_idx: float = Field(gt=0, default=1.0)
    trend: str = Field(default="stable")   # "rising" | "falling" | "stable"
    # Batch context: pass actual restaurant medians so quadrant classification
    # is relative to THIS restaurant's data, not training-time absolutes.
    # If not provided, falls back to training-time thresholds.
    batch_margin_median: Optional[float] = Field(default=None, ge=0, le=1)
    # Batch normalisation: pass max demand across all items so popularity_pct
    # is relative rather than absolute (matches training distribution)
    max_demand_7d: int = Field(ge=0, default=0)



class Engine3Response(BaseModel):
    success: bool
    change: Optional[bool] = None
    direction: Optional[str] = None    # "increase" | "decrease"
    delta: Optional[float] = None
    new_price: Optional[float] = None
    quadrant: Optional[int] = None     # 0=Stars 1=Puzzles 2=Dogs 3=Plowhorses
    quadrant_name: Optional[str] = None
    prob_a: Optional[float] = None
    prob_b: Optional[float] = None
    error: Optional[str] = None
