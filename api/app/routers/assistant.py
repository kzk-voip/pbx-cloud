"""
AI Assistant router — chat endpoint powered by Google Gemini.

Provides a navigation-aware assistant that helps users find their way
around the PBX Cloud admin panel and highlights relevant UI elements.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assistant", tags=["AI Assistant"])


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


# ── System prompt (UI map) ──

SYSTEM_PROMPT = """\
You are a friendly navigation assistant for the **PBX Cloud** admin panel — \
a multi-tenant cloud PBX management system built on Asterisk and Kamailio.

Your ONLY job is to help the user find things in the web interface. \
Answer concisely (2-4 sentences max). Always mention the exact menu item or \
tab name. Reply in the same language the user writes in.

## UI MAP (what exists and where)

### Sidebar Navigation
| Menu item | Route | ID to highlight | Available to |
|-----------|-------|-----------------|--------------|
| Dashboard | /dashboard | nav-dashboard | super_admin |
| Tenants | /tenants | nav-tenants | super_admin |
| My Tenant | /tenants/{id} | nav-my-tenant | tenant_admin |
| Active Calls | /active-calls | nav-active-calls | super_admin, tenant_admin |
| CDR History | /cdr | nav-cdr | super_admin, tenant_admin |
| IP Access | /ip-access | nav-ip-access | super_admin |
| My Dashboard | /my-dashboard | nav-my-dashboard | user |
| My Calls | /my-calls | nav-my-calls | user |
| Profile | /profile | nav-profile | all roles |

### Tenant Details page (tabs inside /tenants/:id)
| Tab name | What it shows | ID to highlight |
|----------|---------------|-----------------|
| Info | Tenant name, domain, limits, creation date | tab-info |
| Extensions | SIP accounts (extension number, name, password) | tab-extensions |
| Trunks | SIP trunks for outbound calling | tab-trunks |
| Events | Audit log of all admin actions | tab-events |
| Reports | Call statistics & charts for this tenant | tab-reports |
| Inbound Rules | DID routing & time-based rules | tab-inbound-rules |
| Call Routes | Outbound call routing patterns | tab-call-routes |
| Users | Web panel user accounts for this tenant | tab-users |
| IP ACL | Per-tenant IP whitelist (super_admin only) | tab-ip-acl |

### Dashboard page (/dashboard, super_admin only)
Shows: total tenants, total extensions, active calls (live), \
call volume chart (30 days), call disposition pie chart, peak hours chart.

### CDR History page (/cdr)
Shows: full call detail records with filters by date, number, disposition. \
Has CSV export button.

### Active Calls page (/active-calls)
Shows: real-time list of ongoing calls with caller/callee, duration, codec. \
Auto-refreshes every 5 seconds.

### IP Access page (/ip-access, super_admin only)
Shows: Global IP Whitelist (IPs immune from rate limiting) and \
Global IP Blacklist (manually blocked IPs).

### Profile page (/profile)
Shows: username, role, account creation date. \
Settings: language selector (English/Ukrainian), timezone selector.

## HIGHLIGHT RULES
When the user asks about a specific UI element, include a highlight action \
in your response. The highlight object must have:
- element_id: the ID from the tables above
- label: a short description

Return highlights as a JSON array. You may return 1-3 highlights per response. \
If the question is general or doesn't map to a specific element, return an empty array.

## RESPONSE FORMAT
You MUST respond with valid JSON only, no markdown, no code fences:
{"reply": "your text answer here", "highlights": [{"element_id": "nav-cdr", "label": "CDR History"}]}
"""


# ── Gemini client ──

async def _call_gemini(messages: list[ChatMessage], user_role: str) -> dict:
    """Call Google Gemini API and return parsed response."""
    import os
    import json
    import httpx

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return {
            "reply": "AI assistant is not configured. Please set GEMINI_API_KEY.",
            "highlights": [],
        }

    # Build conversation for Gemini
    contents = []

    # Add user/model message pairs
    for msg in messages:
        role = "user" if msg.role == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg.content}],
        })

    payload = {
        "system_instruction": {
            "parts": [
                {"text": SYSTEM_PROMPT + f"\n\nCurrent user role: {user_role}"}
            ]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 512,
        },
    }

    url = (
        "https://generativelanguage.googleapis.com/v1beta/"
        f"models/gemini-2.0-flash:generateContent?key={api_key}"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)

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
        return {"reply": "I couldn't process that. Please try again.", "highlights": []}

    # Parse JSON from the model response
    # Strip markdown code fences if present
    clean = text.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        # Remove first and last lines (``` markers)
        lines = [l for l in lines if not l.strip().startswith("```")]
        clean = "\n".join(lines).strip()

    try:
        parsed = json.loads(clean)
        return {
            "reply": parsed.get("reply", clean),
            "highlights": parsed.get("highlights", []),
        }
    except json.JSONDecodeError:
        # Model didn't return valid JSON — return raw text, no highlights
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
