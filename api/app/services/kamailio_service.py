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


# ---- IP Blacklist Management ----

async def dump_blacklist() -> dict | None:
    """Dump all entries from the ipblacklist htable."""
    return await _send_jsonrpc("htable.dump", ["ipblacklist"])


async def blacklist_ip(ip: str) -> bool:
    """Add an IP to the Kamailio blacklist (auto-expires per htable config)."""
    response = await _send_jsonrpc("htable.seti", ["ipblacklist", ip, 1])
    if response and "result" in response:
        logger.info(f"Blacklisted IP in Kamailio: {ip}")
        return True
    logger.warning(f"Failed to blacklist IP in Kamailio: {ip}")
    return False


async def unblacklist_ip(ip: str) -> bool:
    """Remove an IP from the Kamailio blacklist."""
    response = await _send_jsonrpc("htable.delete", ["ipblacklist", ip])
    if response and "result" in response:
        logger.info(f"Removed IP from Kamailio blacklist: {ip}")
        return True
    logger.warning(f"Failed to remove IP from Kamailio blacklist: {ip}")
    return False


# ---- Global IP Whitelist Management ----

async def dump_whitelist() -> dict | None:
    """Dump all entries from the ipwhitelist htable."""
    return await _send_jsonrpc("htable.dump", ["ipwhitelist"])


async def whitelist_ip(ip: str) -> bool:
    """Add an IP to the Kamailio global whitelist (immune from pike/blacklist)."""
    response = await _send_jsonrpc("htable.seti", ["ipwhitelist", ip, 1])
    if response and "result" in response:
        logger.info(f"Whitelisted IP in Kamailio: {ip}")
        return True
    logger.warning(f"Failed to whitelist IP in Kamailio: {ip}")
    return False


async def unwhitelist_ip(ip: str) -> bool:
    """Remove an IP from the Kamailio global whitelist."""
    response = await _send_jsonrpc("htable.delete", ["ipwhitelist", ip])
    if response and "result" in response:
        logger.info(f"Removed IP from Kamailio whitelist: {ip}")
        return True
    logger.warning(f"Failed to remove IP from Kamailio whitelist: {ip}")
    return False


async def sync_global_whitelist_from_db(db_session) -> int:
    """
    Load all global whitelist IPs from DB and sync to Kamailio htable.
    Called on API startup.
    """
    from sqlalchemy import select
    from app.models.global_ip_whitelist import GlobalIpWhitelist

    result = await db_session.execute(select(GlobalIpWhitelist))
    entries = result.scalars().all()

    synced = 0
    for entry in entries:
        success = await whitelist_ip(entry.ip_address)
        if success:
            synced += 1

    logger.info(f"Kamailio whitelist sync: {synced}/{len(entries)} IPs synced")
    return synced


# ---- Tenant IP ACL Management ----
# htable key format: "tenant_slug::ip" = 1  (allowed IP)
# htable key format: "tenant_slug::*" = 1   (ACL marker = enabled)

async def set_tenant_acl_marker(slug: str, enabled: bool) -> bool:
    """Set or remove the ACL-enabled marker for a tenant."""
    key = f"{slug}::*"
    if enabled:
        response = await _send_jsonrpc("htable.seti", ["tenant_acl", key, 1])
    else:
        response = await _send_jsonrpc("htable.delete", ["tenant_acl", key])
    return response is not None and "result" in (response or {})


async def add_tenant_acl_ip(slug: str, ip: str) -> bool:
    """Add an IP to a tenant's ACL in the Kamailio htable."""
    key = f"{slug}::{ip}"
    response = await _send_jsonrpc("htable.seti", ["tenant_acl", key, 1])
    if response and "result" in response:
        logger.info(f"Tenant ACL: added {ip} for {slug}")
        return True
    return False


async def remove_tenant_acl_ip(slug: str, ip: str) -> bool:
    """Remove an IP from a tenant's ACL in the Kamailio htable."""
    key = f"{slug}::{ip}"
    response = await _send_jsonrpc("htable.delete", ["tenant_acl", key])
    return response is not None and "result" in (response or {})


async def clear_tenant_acl(slug: str) -> None:
    """Remove all ACL entries for a tenant from Kamailio htable."""
    # Dump htable and find entries matching this tenant
    result = await _send_jsonrpc("htable.dump", ["tenant_acl"])
    if result and "result" in result:
        for slot in result["result"]:
            if "slot" in slot:
                for item in slot["slot"]:
                    name = item.get("name", "")
                    if name.startswith(f"{slug}::") and name != f"{slug}::*":
                        await _send_jsonrpc("htable.delete", ["tenant_acl", name])


async def sync_tenant_acls_from_db(db_session) -> int:
    """
    Load all tenant IP ACLs from DB and sync to Kamailio htable.
    Called on API startup.
    """
    from sqlalchemy import select
    from app.models.tenant import Tenant
    from app.models.tenant_ip_acl import TenantIpAcl

    # Get all tenants that have ACL entries
    result = await db_session.execute(
        select(TenantIpAcl.tenant_id).distinct()
    )
    tenant_ids = [row[0] for row in result.all()]

    synced = 0
    for tenant_id in tenant_ids:
        # Get tenant slug
        tenant_result = await db_session.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            continue

        # Get all ACL entries
        entries_result = await db_session.execute(
            select(TenantIpAcl).where(TenantIpAcl.tenant_id == tenant_id)
        )
        entries = entries_result.scalars().all()

        if entries:
            await set_tenant_acl_marker(tenant.slug, True)
            for entry in entries:
                await add_tenant_acl_ip(tenant.slug, entry.ip_address)
            synced += len(entries)

    logger.info(f"Kamailio tenant ACL sync: {synced} entries for {len(tenant_ids)} tenants")
    return synced
