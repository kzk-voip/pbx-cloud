"""
WebSocket router — real-time event stream for the admin panel.

Pushes events like call_start, call_end, sip_registered, sip_unregistered
to connected clients. Clients authenticate via JWT in query params.
"""

import asyncio
import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.auth_service import decode_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])

# In-memory set of active WebSocket connections
active_connections: Set[WebSocket] = set()


async def broadcast_event(event_type: str, data: dict):
    """Broadcast an event to all connected WebSocket clients."""
    message = json.dumps({"type": event_type, **data})
    disconnected = set()
    for ws in active_connections:
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.add(ws)
    active_connections.difference_update(disconnected)


@router.websocket("/ws/events")
async def ws_events(websocket: WebSocket, token: str = Query(default="")):
    """
    WebSocket endpoint for real-time PBX events.
    Authenticate via ?token=<JWT> query parameter.

    After connection, the server pushes events and also sends
    periodic active_calls snapshots every 5 seconds.
    """
    # Validate JWT
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    payload = decode_token(token)
    if payload is None:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await websocket.accept()
    active_connections.add(websocket)
    logger.info(f"WS client connected (user={payload.get('sub')}), total={len(active_connections)}")

    try:
        # Keep connection alive; also push periodic active_calls updates
        from app.services.ami_service import AMIClient

        while True:
            # Poll active channels and push snapshot every 5s
            try:
                total = 0
                for port in [5038, 5039]:
                    ami = AMIClient()
                    ami.host = "127.0.0.1"
                    ami.port = port
                    channels = await ami.get_active_channels()
                    total += len(channels)

                await websocket.send_text(json.dumps({
                    "type": "active_calls_update",
                    "active_calls": total,
                }))
            except Exception as e:
                logger.debug(f"WS metrics push error: {e}")

            # Wait 5 seconds, but also listen for client messages (ping/pong)
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
            except asyncio.TimeoutError:
                pass  # Normal — no client message within 5s, loop continues

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WS connection error: {e}")
    finally:
        active_connections.discard(websocket)
        logger.info(f"WS client disconnected, total={len(active_connections)}")
