"""
Health check router.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.redis import get_redis

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    System health check.
    Returns status of database and Redis connections.
    """
    # Check PostgreSQL
    db_ok = False
    try:
        result = await db.execute(text("SELECT 1"))
        db_ok = result.scalar() == 1
    except Exception:
        pass

    # Check Redis
    redis_ok = False
    try:
        redis = get_redis()
        pong = await redis.ping()
        redis_ok = pong is True
    except Exception:
        pass

    status = "ok" if (db_ok and redis_ok) else "degraded"
    return {
        "status": status,
        "database": db_ok,
        "redis": redis_ok,
    }
