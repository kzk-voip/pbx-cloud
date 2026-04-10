"""
PBX Cloud — Redis async client
"""

from redis.asyncio import Redis

from app.config import settings

redis_client: Redis | None = None


async def init_redis() -> Redis:
    """Initialize Redis connection pool."""
    global redis_client
    redis_client = Redis.from_url(
        settings.redis_url,
        decode_responses=True,
    )
    return redis_client


async def close_redis() -> None:
    """Close Redis connection pool."""
    global redis_client
    if redis_client:
        await redis_client.close()
        redis_client = None


def get_redis() -> Redis:
    """Get active Redis client. Raises if not initialized."""
    if redis_client is None:
        raise RuntimeError("Redis is not initialized")
    return redis_client
