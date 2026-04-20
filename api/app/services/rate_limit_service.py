"""
Rate limiting service — Redis-based distributed counters.

Provides per-extension call rate limiting to prevent fraud/abuse.
Works across multiple Asterisk nodes via shared Redis.
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Default max calls per hour per extension
DEFAULT_MAX_CALLS_PER_HOUR = 50


async def check_extension_rate_limit(
    redis,
    extension_id: str,
    max_calls_per_hour: int = DEFAULT_MAX_CALLS_PER_HOUR,
) -> bool:
    """
    Check if an extension has exceeded its call rate limit.

    Returns True if the extension is within limits, False if exceeded.
    Uses Redis INCR + EXPIRE for atomic, distributed counting.
    """
    hour_key = datetime.utcnow().strftime("%Y%m%d%H")
    key = f"rate:ext:{extension_id}:{hour_key}"

    try:
        count = await redis.incr(key)
        if count == 1:
            # First call this hour — set expiry
            await redis.expire(key, 3600)

        if count > max_calls_per_hour:
            logger.warning(
                f"Rate limit exceeded for extension {extension_id}: "
                f"{count}/{max_calls_per_hour} calls/hour"
            )
            return False

        return True
    except Exception as e:
        logger.error(f"Rate limit check failed for {extension_id}: {e}")
        # Fail-open: allow the call if Redis is down
        return True


async def get_extension_call_count(redis, extension_id: str) -> int:
    """Get current call count for an extension this hour."""
    hour_key = datetime.utcnow().strftime("%Y%m%d%H")
    key = f"rate:ext:{extension_id}:{hour_key}"

    try:
        count = await redis.get(key)
        return int(count) if count else 0
    except Exception:
        return 0
