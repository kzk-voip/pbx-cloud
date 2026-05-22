"""
AI Assistant router — chat endpoint powered by Google Gemini.

Provides a navigation-aware assistant that helps users find their way
around the PBX Cloud admin panel and highlights relevant UI elements.

The UI context is loaded from ``ai_context/ui_map.json`` at import time
so that the file can be regenerated independently when the UI changes.
"""

import json
import logging
import os
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assistant", tags=["AI Assistant"])


# ── Load UI context from file ──

_CONTEXT_DIR = Path(__file__).resolve().parent.parent.parent / "ai_context"
_UI_MAP_PATH = _CONTEXT_DIR / "ui_map.json"

def _load_ui_map() -> str:
    """Read the structured UI map and return it as a formatted string."""
    try:
        with open(_UI_MAP_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return json.dumps(data, ensure_ascii=False, indent=2)
    except FileNotFoundError:
        logger.warning("UI map not found at %s — using fallback", _UI_MAP_PATH)
        return "{}"
    except json.JSONDecodeError as exc:
        logger.error("Invalid JSON in UI map: %s", exc)
        return "{}"


_UI_MAP_TEXT = _load_ui_map()

_SYSTEM_PROMPT = f"""\
You are a friendly navigation assistant for the PBX Cloud admin panel.

Your ONLY job is to help the user find things in the web interface.
Answer concisely (2-4 sentences max). Always mention the exact menu item or
tab name the user should click. Reply in the same language the user writes in.

Below is the complete map of the application UI in JSON format.
Use it to answer questions accurately.

--- BEGIN UI MAP ---
{_UI_MAP_TEXT}
--- END UI MAP ---

RULES:
1. When the user asks about a specific UI element, include highlight actions
   using the sidebar_id or tab_id values from the map above.
2. You may return 1-3 highlights per response.
3. If the question is general or does not map to a specific element, return
   an empty highlights array.
4. You MUST respond with valid JSON only. No markdown, no code fences.
   Format: {{"reply": "your text", "highlights": [{{"element_id": "nav-cdr", "label": "CDR History"}}]}}
"""


# ── Schemas ──

class ChatMessage(BaseModel):
    role: str = Field(..., examples=["user"])
    content: str = Field(..., examples=["Where can I see call logs?"])


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class HighlightAction(BaseModel):
    element_id: str = Field(..., description="DOM element id to highlight")
    label: str = Field("", description="Human-readable label for the element")


class ChatResponse(BaseModel):
    reply: str
    highlights: list[HighlightAction] = []


# ── Gemini client ──

_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


async def _call_gemini(messages: list[ChatMessage], user_role: str) -> dict:
    """Call Google Gemini API and return parsed response."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return {
            "reply": "AI assistant is not configured. Please set GEMINI_API_KEY.",
            "highlights": [],
        }

    # Build conversation for Gemini
    contents = []
    for msg in messages:
        role = "user" if msg.role == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg.content}],
        })

    payload = {
        "system_instruction": {
            "parts": [
                {"text": _SYSTEM_PROMPT + f"\n\nCurrent user role: {user_role}"}
            ]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 512,
            "responseMimeType": "application/json",
        },
    }

    url = (
        "https://generativelanguage.googleapis.com/v1beta/"
        f"models/{_GEMINI_MODEL}:generateContent?key={api_key}"
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.post(url, json=payload)
    except httpx.RequestError as exc:
        logger.error("Gemini network error: %s", exc)
        return {
            "reply": "Cannot reach the AI service. Please try again later.",
            "highlights": [],
        }

    if resp.status_code != 200:
        logger.error("Gemini API error %s: %s", resp.status_code, resp.text)
        return {
            "reply": "Sorry, the AI service is temporarily unavailable.",
            "highlights": [],
        }

    data = resp.json()

    # Extract text from Gemini response
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        logger.error("Unexpected Gemini response: %s", data)
        return {
            "reply": "I couldn't process that. Please try again.",
            "highlights": [],
        }

    # Parse JSON response
    clean = text.strip()
    # Strip markdown code fences if present
    if clean.startswith("```"):
        lines = clean.split("\n")
        lines = [ln for ln in lines if not ln.strip().startswith("```")]
        clean = "\n".join(lines).strip()

    try:
        parsed = json.loads(clean)
        return {
            "reply": parsed.get("reply", clean),
            "highlights": parsed.get("highlights", []),
        }
    except json.JSONDecodeError:
        # Model returned plain text instead of JSON
        return {"reply": text.strip(), "highlights": []}


# ── Endpoint ──

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user: User = Depends(get_current_user),
):
    """
    Send a message to the AI navigation assistant.
    Returns a text reply and optional UI element highlights.
    """
    if not request.messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Messages list cannot be empty",
        )

    # Limit conversation history to last 10 messages
    recent = request.messages[-10:]

    result = await _call_gemini(recent, user.role)
    return ChatResponse(
        reply=result["reply"],
        highlights=[
            HighlightAction(element_id=h["element_id"], label=h.get("label", ""))
            for h in result.get("highlights", [])
            if isinstance(h, dict) and "element_id" in h
        ],
    )
