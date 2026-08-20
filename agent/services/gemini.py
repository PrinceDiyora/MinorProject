"""
gemini.py — All LLM operations for the voice ordering agent (v2).

Five focused async functions:
  extract_order()       → {reply, cart_updates, done_ordering}
  pitch_combos()        → str  (spoken combo suggestion)
  handle_combo_reply()  → {cart_updates}
  extract_field()       → str | None
  classify_yes_no()     → "YES" | "NO" | "CANCEL" | "UNKNOWN"

All functions are async. Blocking _llm.invoke() calls are wrapped in
asyncio.to_thread() so the event loop is never blocked.

Every function guarantees a non-empty messages list to avoid the
"contents are required" Gemini API error.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re

from langchain_google_genai  import ChatGoogleGenerativeAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

log = logging.getLogger("gemini")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=GEMINI_API_KEY,
    temperature=0.2,
    max_tokens=512,
)
_llm_fast = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=GEMINI_API_KEY,
    temperature=0.0,
    max_tokens=128,
)

_LANG_NAMES = {
    "hi-IN": "Hindi",  "en-IN": "English",  "gu-IN": "Gujarati",
    "ta-IN": "Tamil",  "te-IN": "Telugu",   "mr-IN": "Marathi",
    "bn-IN": "Bengali","kn-IN": "Kannada",
}


# ── Internal helpers ──────────────────────────────────────────────────────────

def _strip_fences(text: str) -> str:
    cleaned = re.sub(r"```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    return cleaned.replace("```", "").strip()


def _parse_json(raw: str, fallback: dict) -> dict:
    try:
        cleaned = _strip_fences(raw)
        m = re.search(r"\{[\s\S]*\}", cleaned)
        if m:
            return json.loads(m.group(0))
    except Exception:
        pass
    return fallback


async def _call(messages: list) -> str:
    """Async wrapper — runs blocking _llm.invoke in a thread."""
    resp = await asyncio.to_thread(_llm.invoke, messages)
    return resp.content


async def _call_fast(messages: list) -> str:
    """Async wrapper — runs blocking _llm_fast.invoke in a thread."""
    resp = await asyncio.to_thread(_llm_fast.invoke, messages)
    return resp.content


def _history_to_messages(history: list[dict]) -> list:
    """Convert conversation history list to LangChain message objects."""
    msgs = []
    for turn in history:
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        if turn.get("role") == "human":
            msgs.append(HumanMessage(content=content))
        else:
            msgs.append(AIMessage(content=content))
    return msgs


# ── 1. Order extraction ───────────────────────────────────────────────────────

_ORDER_SYSTEM = """\
You are a fast, friendly restaurant voice ordering assistant.
Always reply in the SAME language the customer used.

MENU (use these exact food_id values):
{menu_json}

CURRENT CART:
{cart_json}

RULES:
1. Add / update / remove items from the cart based on what the customer says.
2. Default quantity = 1. quantity=0 means remove the item.
3. Set done_ordering=true ONLY when the customer explicitly says they are done
   ordering (words like: bas, done, ho gaya, order karo, khatam, place order,
   ऑर्डर करो, बस, हो गया, ऑर्डर कंप्लीट, कन्फर्म, खत्म, complete, finalize).
4. Keep reply to 1 short sentence.
5. If item not found in menu, say it's unavailable and suggest similar.

Return ONLY raw JSON — no markdown fences, no explanation:
{{"reply":"<1 sentence>","cart_updates":[{{"food_id":<int>,"name":"<str>","quantity":<int>,"price":<float>}}],"done_ordering":<true|false>}}\
"""

_DONE_RE = re.compile(
    r"\b(?:bas|done|finish(?:ed)?|finalize|place.?order|confirm|ho.?gaya|ho.?gya|"
    r"thats?.?all|order.?kar[oa]?|proceed|complete|sab.?ho.?gaya|bas.?yahi|"
    r"yahi.?chahiye|nothing.?else|i.?m.?done|that.?will.?be.?all|order.?place|"
    r"place.?kar|khatam|order.?do|pakka|no.?more|ready|final|over)\b"
    r"|बस|हो\s*गया|हो\s*गी|ऑर्डर\s*(?:कर|करो|कर\s*दो|करना|कन्फ़र्म|कंप्लीट)"
    r"|पूरा|खतम|और\s*कुछ\s*नहीं|और\s*नहीं|बस\s*इतना|कन्फ़र्म|कम्प्लीट"
    r"|प्लेस\s*ऑर्डर|यही\s*चाहिए|इतना\s*ही",
    re.IGNORECASE | re.UNICODE,
)


async def extract_order(
    transcript: str,
    menu: list[dict],
    cart: list[dict],
    history: list[dict],
    language: str = "hi-IN",
) -> dict:
    """
    Extract ordering intent from one user utterance.
    Returns: {reply: str, cart_updates: list, done_ordering: bool}
    """
    compact_menu = [
        {
            "id":    m.get("id") or m.get("food_id"),
            "name":  m.get("name", ""),
            "price": m.get("selling_price", m.get("price", 0)),
            "cat":   m.get("category_name", ""),
        }
        for m in menu
        if m.get("is_available", True)
    ]

    system_content = _ORDER_SYSTEM.format(
        menu_json=json.dumps(compact_menu, ensure_ascii=False),
        cart_json=json.dumps(cart,         ensure_ascii=False),
    )

    # Always: SystemMessage + history messages + current transcript as HumanMessage
    messages = [SystemMessage(content=system_content)]
    messages.extend(_history_to_messages(history))
    messages.append(HumanMessage(content=transcript))  # guaranteed non-empty

    fallback = {
        "reply":        "Sorry, dobara boliye?",
        "cart_updates": [],
        "done_ordering": False,
    }

    try:
        raw    = await _call(messages)
        result = _parse_json(raw, fallback)
    except Exception as exc:
        log.error("extract_order LLM failed: %s", exc)
        result = fallback

    # Server-side done-override — catches what LLM might miss
    if not result.get("done_ordering") and cart and _DONE_RE.search(transcript):
        log.info("Server-side DONE detected: %r", transcript[:50])
        result["done_ordering"] = True
        result["cart_updates"]  = []

    return result


# ── 2. Combo pitch ────────────────────────────────────────────────────────────

_PITCH_SYSTEM = """\
The customer just finished ordering. Suggest 1-2 of these add-ons warmly.

THEIR ORDER: {cart_json}

AVAILABLE ADD-ONS: {combos_json}

Speak naturally in {lang_name} in 2-3 short, enthusiastic sentences.
Do NOT return JSON — just speak naturally like a helpful waiter.\
"""


async def pitch_combos(
    cart: list[dict],
    combos: list[dict],
    language: str = "hi-IN",
) -> str:
    """Generate a natural-sounding combo pitch. Returns plain text to speak."""
    lang_name = _LANG_NAMES.get(language, "Hindi")
    system = _PITCH_SYSTEM.format(
        cart_json=json.dumps(cart,          ensure_ascii=False),
        combos_json=json.dumps(combos[:4],  ensure_ascii=False),
        lang_name=lang_name,
    )
    messages = [
        SystemMessage(content=system),
        HumanMessage(content="Suggest add-ons now."),
    ]
    try:
        return await _call(messages)
    except Exception as exc:
        log.error("pitch_combos failed: %s", exc)
        return "Kya aap kuch aur add karna chahenge? Hamare paas kuch amazing add-ons hain!"


# ── 3. Combo reply handler ─────────────────────────────────────────────────────

_COMBO_REPLY_SYSTEM = """\
The customer replied to your add-on suggestion. Extract what (if anything) they want to add.

ADD-ONS THAT WERE OFFERED:
{combos_json}

CUSTOMER SAID: "{transcript}"

If they want to add something → include it in cart_updates with the correct food_id, name, price, quantity=1.
If they decline or say no → return empty cart_updates.

Return ONLY raw JSON:
{{"cart_updates":[{{"food_id":<int>,"name":"<str>","quantity":<int>,"price":<float>}}]}}\
"""


async def handle_combo_reply(
    transcript: str,
    combos: list[dict],
    language: str = "hi-IN",
) -> dict:
    """
    Parse customer's response to the combo pitch.
    Returns: {cart_updates: list}
    """
    if not combos:
        return {"cart_updates": []}

    system = _COMBO_REPLY_SYSTEM.format(
        combos_json=json.dumps(combos, ensure_ascii=False),
        transcript=transcript,
    )
    messages = [
        SystemMessage(content=system),
        HumanMessage(content=transcript),
    ]
    fallback = {"cart_updates": []}
    try:
        raw = await _call_fast(messages)
        return _parse_json(raw, fallback)
    except Exception as exc:
        log.error("handle_combo_reply failed: %s", exc)
        return fallback


# ── 4. Field extraction ────────────────────────────────────────────────────────

_FIELD_SYSTEMS = {
    "name": (
        'Extract the person\'s name from this message: "{transcript}"\n'
        "Return ONLY the name (clean, no extra words). If you cannot find a name, return: NONE"
    ),
    "phone": (
        'Extract the 10-digit mobile number from: "{transcript}"\n'
        "Return ONLY the digits (no spaces, dashes, or other characters). If unclear, return: NONE"
    ),
    "address": (
        'Extract the delivery address from: "{transcript}"\n'
        "Return ONLY the address text as-is. If no address found, return: NONE"
    ),
}


async def extract_field(
    field: str,
    transcript: str,
    language: str = "hi-IN",
) -> str | None:
    """
    Extract a single customer info field from free-form transcript.
    Returns the extracted string, or None if not found.
    """
    template = _FIELD_SYSTEMS.get(
        field,
        'Extract the {field} from: "{transcript}"\nReturn just the value or NONE.'.format(
            field=field, transcript=transcript
        ),
    )
    system = template.format(transcript=transcript)
    messages = [
        SystemMessage(content=system),
        HumanMessage(content=transcript),
    ]
    try:
        raw = (await _call_fast(messages)).strip()
        if not raw or raw.upper() == "NONE":
            return None
        if field == "phone":
            digits = re.sub(r"\D", "", raw)
            if len(digits) >= 10:
                return digits[:10]
            return digits if digits else None
        return raw
    except Exception as exc:
        log.error("extract_field(%s) failed: %s", field, exc)
        return None


# ── 5. Yes / No classifier ─────────────────────────────────────────────────────

_CONFIRM_SYSTEM = """\
Classify this customer response as exactly one of: YES, NO, CANCEL, or UNKNOWN.

YES    = confirming / agreeing (haan, yes, bilkul, theek hai, sahi, ok, kar do, confirm, haa)
NO     = wants to change something (nahi, no, change karo, modify, badlo, wapas, kuch aur)
CANCEL = cancelling the entire order (cancel, mat karo, rehne do, nahi chahiye, band karo)
UNKNOWN = cannot determine clearly

Customer said: "{transcript}"

Return EXACTLY one word — either YES, NO, CANCEL, or UNKNOWN. Nothing else.\
"""


async def classify_yes_no(transcript: str, language: str = "hi-IN") -> str:
    """Returns 'YES', 'NO', 'CANCEL', or 'UNKNOWN'."""
    system = _CONFIRM_SYSTEM.format(transcript=transcript)
    messages = [
        SystemMessage(content=system),
        HumanMessage(content=transcript),
    ]
    try:
        raw = (await _call_fast(messages)).strip().upper()
        if raw in ("YES", "NO", "CANCEL", "UNKNOWN"):
            return raw
    except Exception as exc:
        log.error("classify_yes_no LLM failed: %s", exc)

    # Heuristic fallback
    t = transcript.lower()
    if any(w in t for w in ["haan", " han ", "yes", "bilkul", "kar do", "confirm",
                              "theek hai", "sahi hai", " ok ", "okay", " ha ", "haa"]):
        return "YES"
    if any(w in t for w in ["nahi", "nah ", " no ", "change", "badlo", "modify"]):
        return "NO"
    if any(w in t for w in ["cancel", "mat karo", "band karo", "rehne do", "chod do"]):
        return "CANCEL"
    return "UNKNOWN"
