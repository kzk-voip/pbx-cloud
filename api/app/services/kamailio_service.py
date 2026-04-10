"""
Kamailio service — JSONRPC client for dynamic htable management.

Communicates with Kamailio's jsonrpcs module over UDP datagram
to add/remove tenant domains from the htable without Kamailio restart.
"""

import json
import logging
import socket

logger = logging.getLogger(__name__)

KAMAILIO_JSONRPC_HOST = "127.0.0.1"
KAMAILIO_JSONRPC_PORT = 9090
TIMEOUT_SECONDS = 3


def _send_jsonrpc(method: str, params: list) -> dict | None:
    """
    Send a JSONRPC request to Kamailio via UDP datagram.
    Returns the parsed response or None on failure.
    """
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1,
    })

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(TIMEOUT_SECONDS)
        sock.sendto(payload.encode("utf-8"), (KAMAILIO_JSONRPC_HOST, KAMAILIO_JSONRPC_PORT))
        data, _ = sock.recvfrom(4096)
        sock.close()
        response = json.loads(data.decode("utf-8"))
        logger.info(f"Kamailio JSONRPC {method}: {response}")
        return response
    except socket.timeout:
        logger.error(f"Kamailio JSONRPC timeout for {method}")
        return None
    except Exception as e:
        logger.error(f"Kamailio JSONRPC error for {method}: {e}")
        return None


def add_tenant_domain(domain: str, slug: str) -> bool:
    """
    Add a tenant domain to Kamailio's htable.
    Equivalent to: kamcmd htable.sets tenants <domain> s:<slug>
    """
    response = _send_jsonrpc("htable.sets", ["tenants", domain, slug])
    if response and "result" in response:
        logger.info(f"Added tenant domain to Kamailio: {domain} -> {slug}")
        return True
    logger.warning(f"Failed to add tenant domain to Kamailio: {domain}")
    return False


def remove_tenant_domain(domain: str) -> bool:
    """
    Remove a tenant domain from Kamailio's htable.
    Equivalent to: kamcmd htable.delete tenants <domain>
    """
    response = _send_jsonrpc("htable.delete", ["tenants", domain])
    if response and "result" in response:
        logger.info(f"Removed tenant domain from Kamailio: {domain}")
        return True
    logger.warning(f"Failed to remove tenant domain from Kamailio: {domain}")
    return False
