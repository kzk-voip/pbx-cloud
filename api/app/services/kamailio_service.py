"""
Kamailio service — async JSONRPC client for dynamic htable management.

Communicates with Kamailio's jsonrpcs module over UDP datagram (transport=4)
to add/remove tenant domains from the htable without Kamailio restart.

Architecture:
  - htable loads from PostgreSQL on startup (via db_url)
  - JSONRPC adds/removes entries dynamically (for immediate effect)
  - sqlops fallback in TENANT_LOOKUP queries DB on cache miss

All methods are async to avoid blocking the FastAPI event loop.
"""

import asyncio
import json
import logging

from app.config import settings

logger = logging.getLogger(__name__)


async def _send_jsonrpc(method: str, params: list) -> dict | None:
    """
    Send a JSONRPC request to Kamailio via async UDP datagram.
    Returns the parsed response or None on failure.
    """
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1,
    }).encode("utf-8")

    host = settings.kamailio_jsonrpc_host
    port = settings.kamailio_jsonrpc_port
    timeout = settings.kamailio_jsonrpc_timeout

    loop = asyncio.get_running_loop()
    future = loop.create_future()

    class JSONRPCProtocol(asyncio.DatagramProtocol):
        def __init__(self):
            self.transport = None

        def connection_made(self, transport):
            self.transport = transport
            self.transport.sendto(payload, (host, port))

        def datagram_received(self, data, addr):
            if not future.done():
                future.set_result(data)

        def error_received(self, exc):
            if not future.done():
                future.set_exception(exc)

        def connection_lost(self, exc):
            if not future.done():
                future.set_exception(exc or ConnectionError("Connection lost"))

    transport = None
    try:
        transport, protocol = await loop.create_datagram_endpoint(
            JSONRPCProtocol,
            remote_addr=(host, port),
        )
        data = await asyncio.wait_for(future, timeout=timeout)
        response = json.loads(data.decode("utf-8"))
        logger.info(f"Kamailio JSONRPC {method}: {response}")
        return response
    except asyncio.TimeoutError:
        logger.error(f"Kamailio JSONRPC timeout for {method}")
        return None
    except Exception as e:
        logger.error(f"Kamailio JSONRPC error for {method}: {e}")
        return None
    finally:
        if transport is not None:
            transport.close()


async def add_tenant_domain(domain: str, slug: str) -> bool:
    """
    Add a tenant domain to Kamailio's htable.
    Uses htable.sets (set string value).
    """
    response = await _send_jsonrpc("htable.sets", ["tenants", domain, slug])
    if response and "result" in response:
        logger.info(f"Added tenant domain to Kamailio: {domain} -> {slug}")
        return True
    logger.warning(f"Failed to add tenant domain to Kamailio: {domain}")
    return False


async def remove_tenant_domain(domain: str) -> bool:
    """
    Remove a tenant domain from Kamailio's htable.
    """
    response = await _send_jsonrpc("htable.delete", ["tenants", domain])
    if response and "result" in response:
        logger.info(f"Removed tenant domain from Kamailio: {domain}")
        return True
    logger.warning(f"Failed to remove tenant domain from Kamailio: {domain}")
    return False


async def dump_htable() -> dict | None:
    """
    Dump all entries from the tenants htable for diagnostics.
    """
    return await _send_jsonrpc("htable.dump", ["tenants"])


async def sync_all_tenants_from_db(db_session) -> int:
    """
    Load all active tenants from PostgreSQL and sync them to Kamailio htable.
    Called on API startup to ensure Kamailio has all tenant domains.
    
    Note: with htable db_url configured, Kamailio already loads from DB on startup.
    This function provides an additional sync for cases where the API starts
    after Kamailio and new tenants were added while Kamailio was already running.
    """
    from sqlalchemy import select
    from app.models.tenant import Tenant

    result = await db_session.execute(
        select(Tenant).where(Tenant.is_active == True)
    )
    tenants = result.scalars().all()

    synced = 0
    for tenant in tenants:
        success = await add_tenant_domain(tenant.domain, tenant.slug)
        if success:
            synced += 1
        else:
            logger.warning(
                f"Failed to sync tenant {tenant.slug} ({tenant.domain}) to Kamailio"
            )

    logger.info(f"Kamailio htable sync complete: {synced}/{len(tenants)} tenants synced")
    return synced
