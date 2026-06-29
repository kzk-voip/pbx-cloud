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
import re
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


def _load_ui_map() -> tuple[str, dict]:
    """Read the structured UI map, return (text_for_prompt, raw_dict)."""
    try:
        with open(_UI_MAP_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return json.dumps(data, ensure_ascii=False, indent=2), data
    except FileNotFoundError:
        logger.warning("UI map not found at %s — using fallback", _UI_MAP_PATH)
        return "{}", {}
    except json.JSONDecodeError as exc:
        logger.error("Invalid JSON in UI map: %s", exc)
        return "{}", {}


_UI_MAP_TEXT, _UI_MAP_DATA = _load_ui_map()


# ── Build keyword → highlight mapping from UI map ──

def _build_highlight_index(ui_map: dict) -> list[tuple[re.Pattern, dict]]:
    """
    Create a list of (compiled_regex, highlight_info) pairs from the UI map.
    When the AI reply contains a keyword, we auto-attach the matching highlight.
    """
    entries = []
    for page in ui_map.get("pages", []):
        name = page.get("name", "")
        sidebar_id = page.get("sidebar_id", "")
        if sidebar_id and name:
            # Match page name (case-insensitive, whole word)
            pattern = re.compile(re.escape(name), re.IGNORECASE)
            entries.append((pattern, {"element_id": sidebar_id, "label": name}))

        # Also index tabs inside pages
        for tab in page.get("tabs", []):
            tab_name = tab.get("name", "")
            tab_id = tab.get("tab_id", "")
            if tab_id and tab_name:
                pattern = re.compile(re.escape(tab_name), re.IGNORECASE)
                entries.append((pattern, {"element_id": tab_id, "label": tab_name}))

    return entries


_HIGHLIGHT_INDEX = _build_highlight_index(_UI_MAP_DATA)


def _detect_highlights(reply_text: str) -> list[dict]:
    """Scan reply text for known UI element names and return highlights."""
    found = []
    seen_ids = set()
    for pattern, hl_info in _HIGHLIGHT_INDEX:
        if pattern.search(reply_text) and hl_info["element_id"] not in seen_ids:
            found.append(hl_info)
            seen_ids.add(hl_info["element_id"])
            if len(found) >= 3:
                break
    return found


# ── System prompt (compact) ──

def _build_compact_prompt(ui_map: dict) -> str:
    """Build a compact text prompt from the ui_map data."""
    lines = []
    for page in ui_map.get("pages", []):
        roles = ", ".join(page.get("roles", []))
        desc = page.get("description", "")
        lines.append(f"- **{page['name']}** ({page.get('route','')}) [{roles}]: {desc}")
        for tab in page.get("tabs", []):
            tab_roles = ", ".join(tab.get("roles", page.get("roles", [])))
            lines.append(f"  - Tab \"{tab['name']}\": {tab.get('description', '')}")
    return "\n".join(lines)


_COMPACT_MAP = _build_compact_prompt(_UI_MAP_DATA)

_SYSTEM_PROMPT = f"""\
You are a navigation assistant for PBX Cloud — a cloud PBX admin panel.
Help users find features in the interface. Be concise (2-3 sentences).
Always name the exact menu item or tab. Reply in the user's language.

## Pages & Tabs
{_COMPACT_MAP}

RULES:
1. Name exact page and tab (e.g. "go to Tenants, then Extensions tab").
2. Keep answers short — max 3 sentences, plain text only.
3. Do NOT use markdown formatting like **bold** or *italic*. Write plain text.
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

_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")


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
            "maxOutputTokens": 1024,
        },
    }

    url = (
        "https://generativelanguage.googleapis.com/v1beta/"
        f"models/{_GEMINI_MODEL}:generateContent?key={api_key}"
    )

    headers = {
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.post(url, json=payload, headers=headers)
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

    reply = _clean_reply(text)

    # Auto-detect highlights from reply text using the UI map index
    highlights = _detect_highlights(reply)

    return {"reply": reply, "highlights": highlights}


def _clean_reply(raw: str) -> str:
    """Extract clean reply text from model output, stripping JSON/markdown."""
    text = raw.strip()

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        lines = [ln for ln in lines[1:] if ln.strip() != "```"]
        text = "\n".join(lines).strip()

    # Try to parse as JSON and extract "reply" field
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict) and "reply" in parsed:
            return parsed["reply"]
    except (json.JSONDecodeError, TypeError):
        pass

    # Regex fallback: extract "reply": "..." from partial/broken JSON
    match = re.search(r'"reply"\s*:\s*"((?:[^"\\]|\\.)*)"?', text)
    if match:
        return match.group(1).replace('\\"', '"').replace("\\n", "\n")

    # If text starts with JSON-like characters, try harder to clean
    if text.startswith("{") or text.startswith("Analyse"):
        # Remove JSON artifact prefixes
        for prefix in ('Analyse the JSON structure:', 'Analyze the JSON structure:'):
            if text.startswith(prefix):
                text = text[len(prefix):].strip()
        # Try JSON parse again after cleanup
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict) and "reply" in parsed:
                return parsed["reply"]
        except (json.JSONDecodeError, TypeError):
            pass

    # Strip markdown formatting (bold, italic)
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # **bold** → bold
    text = re.sub(r'\*(.+?)\*', r'\1', text)       # *italic* → italic
    text = re.sub(r'__(.+?)__', r'\1', text)       # __bold__ → bold
    text = re.sub(r'_(.+?)_', r'\1', text)         # _italic_ → italic

    return text


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
