"""
nodejs_api.py — Async httpx calls to the Node.js backend.

All three voice-agent routes:
  GET  /api/voice/menu?admin_id=X
  POST /api/voice/recommendations  {admin_id, food_ids}
  POST /api/voice/orders           {admin_id, customer, items, total_amount}
"""

from __future__ import annotations

import os
import httpx

NODEJS_BASE_URL  = os.getenv("NODEJS_BASE_URL", "http://localhost:8000")
VOICE_INTERNAL_KEY = os.getenv("VOICE_INTERNAL_KEY", "")

_HEADERS = {
    "Content-Type":  "application/json",
    "x-voice-key":   VOICE_INTERNAL_KEY,
}


async def fetch_menu(admin_id: int) -> list[dict]:
    """
    GET /api/voice/menu?admin_id=X
    Returns list of available food items:
      [{id, name, selling_price, category_id, category_name, is_available, quantity}]
    """
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{NODEJS_BASE_URL}/api/voice/menu",
            params={"admin_id": admin_id},
            headers=_HEADERS,
        )
    if response.status_code != 200:
        raise RuntimeError(f"Failed to fetch menu: {response.status_code} {response.text}")
    return response.json().get("data", [])


async def fetch_recommendations(admin_id: int, food_ids: list[int]) -> list[dict]:
    """
    POST /api/voice/recommendations {admin_id, food_ids}
    Returns combo suggestions:
      [{combo_name, items:[{food_id,name,price}], combo_price, savings}]
    Returns empty list on any error (non-critical path).
    """
    if not food_ids:
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{NODEJS_BASE_URL}/api/voice/recommendations",
                json={"admin_id": admin_id, "food_ids": food_ids},
                headers=_HEADERS,
            )
        if response.status_code == 200:
            return response.json().get("data", [])
    except Exception:
        pass
    return []


async def place_order(
    admin_id: int,
    customer: dict,
    items: list[dict],
    total_amount: float,
) -> dict:
    """
    POST /api/voice/orders
    Body: {admin_id, customer:{name,phone,address}, items:[...], total_amount}
    Returns: {order_id: int, status: "pending"}
    Raises RuntimeError on failure.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"{NODEJS_BASE_URL}/api/voice/orders",
            json={
                "admin_id":     admin_id,
                "customer":     customer,
                "items":        items,
                "total_amount": total_amount,
            },
            headers=_HEADERS,
        )
    if response.status_code != 201:
        raise RuntimeError(f"Failed to place order: {response.status_code} {response.text}")
    return response.json().get("data", {})
