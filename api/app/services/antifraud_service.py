"""
Anti-fraud service — Redis-based call rate limiting per extension.

Uses a sliding window counter in Redis to track calls per extension per hour.
If an extension exceeds the configured limit, further calls are rejected.

Architecture:
  - Redis key pattern: antifraud:calls:{tenant_slug}:{ext_number}
  - TTL: 3600 seconds (1 hour sliding window)
  - Default limit: 60 calls per hour per extension
"""

import logging

from app.redis import get_redis
from app.config import settings

logger = logging.getLogger(__name__)

# Default: 60 calls per hour per extension
DEFAULT_MAX_CALLS_PER_HOUR = 60


async def check_call_rate(tenant_slug: str, extension: str, max_calls: int = DEFAULT_MAX_CALLS_PER_HOUR) -> bool:
    """
    Check if an extension has exceeded its call rate limit.

    Returns True if the call is ALLOWED, False if rate limit exceeded.
    """
    redis = get_redis()
    if redis is None:
        # If Redis is unavailable, allow the call (fail-open)
        logger.warning("Redis unavailable — skipping call rate check")
        return True

    key = f"antifraud:calls:{tenant_slug}:{extension}"

    try:
        current = await redis.get(key)
        count = int(current) if current else 0

        if count >= max_calls:
            logger.warning(
                f"Anti-fraud: rate limit exceeded for {tenant_slug}_{extension} "
                f"({count}/{max_calls} calls/hour)"
            )
            return False

        return True
    except Exception as e:
        logger.error(f"Anti-fraud check error: {e}")
        return True  # fail-open


async def record_call(tenant_slug: str, extension: str) -> int:
    """
    Record a call for rate limiting purposes.
    Increments the call counter and sets/refreshes TTL.

    Returns the new call count.
    """
    redis = get_redis()
    if redis is None:
        return 0

    key = f"antifraud:calls:{tenant_slug}:{extension}"

    try:
        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, 3600)  # 1 hour TTL
        results = await pipe.execute()
        count = results[0]

        if count % 10 == 0:  # Log every 10th call
            logger.info(f"Anti-fraud: {tenant_slug}_{extension} call count: {count}/hour")

        return count
    except Exception as e:
        logger.error(f"Anti-fraud record error: {e}")
        return 0


async def get_call_count(tenant_slug: str, extension: str) -> int:
    """Get current call count for an extension."""
    redis = get_redis()
    if redis is None:
        return 0

    key = f"antifraud:calls:{tenant_slug}:{extension}"

    try:
        current = await redis.get(key)
        return int(current) if current else 0
    except Exception as e:
        logger.error(f"Anti-fraud count error: {e}")
        return 0


async def reset_call_count(tenant_slug: str, extension: str) -> bool:
    """Reset call counter for an extension (admin action)."""
    redis = get_redis()
    if redis is None:
        return False

    key = f"antifraud:calls:{tenant_slug}:{extension}"

    try:
        await redis.delete(key)
        logger.info(f"Anti-fraud: reset counter for {tenant_slug}_{extension}")
        return True
    except Exception as e:
        logger.error(f"Anti-fraud reset error: {e}")
        return False
