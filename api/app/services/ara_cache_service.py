"""
ARA cache service — caches endpoint configuration in Redis.

Reduces PostgreSQL load for repeated API queries about endpoint status.
TTL-based invalidation ensures data doesn't go stale for long.
"""

import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Default cache TTL in seconds
ARA_CACHE_TTL = 60


async def get_cached_endpoint(redis, endpoint_id: str) -> Optional[dict]:
    """Get endpoint config from Redis cache."""
    try:
        cached = await redis.get(f"ara:endpoint:{endpoint_id}")
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"Redis cache read error for {endpoint_id}: {e}")
    return None


async def set_cached_endpoint(redis, endpoint_id: str, data: dict, ttl: int = ARA_CACHE_TTL):
    """Cache endpoint config in Redis with TTL."""
    try:
        await redis.setex(
            f"ara:endpoint:{endpoint_id}",
            ttl,
            json.dumps(data, default=str),
        )
    except Exception as e:
        logger.warning(f"Redis cache write error for {endpoint_id}: {e}")


async def invalidate_endpoint(redis, endpoint_id: str):
    """Invalidate cache when endpoint is created/updated/deleted via API."""
    try:
        await redis.delete(f"ara:endpoint:{endpoint_id}")
        logger.debug(f"Cache invalidated for endpoint: {endpoint_id}")
    except Exception as e:
        logger.warning(f"Redis cache invalidation error for {endpoint_id}: {e}")


async def invalidate_tenant_endpoints(redis, tenant_slug: str):
    """Invalidate all cached endpoints for a tenant (pattern delete)."""
    try:
        pattern = f"ara:endpoint:{tenant_slug}_*"
        cursor = 0
        while True:
            cursor, keys = await redis.scan(cursor, match=pattern, count=100)
            if keys:
                await redis.delete(*keys)
            if cursor == 0:
                break
        logger.debug(f"Cache invalidated for all endpoints of tenant: {tenant_slug}")
    except Exception as e:
        logger.warning(f"Redis cache bulk invalidation error for {tenant_slug}: {e}")
