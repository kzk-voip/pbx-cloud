"""
PBX Cloud — FastAPI Application Entry Point
"""

import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import async_session
from app.redis import init_redis, close_redis
from app.routers import health, auth, tenants, extensions, trunks, cdr, calls, admin, blacklist
from app.services import kamailio_service

# Configure logging for all app.* loggers
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle: startup and shutdown events."""
    # Startup
    await init_redis()

    # Sync all active tenants to Kamailio htable
    try:
        async with async_session() as db:
            synced = await kamailio_service.sync_all_tenants_from_db(db)
            logger.info(f"Startup: synced {synced} tenants to Kamailio htable")
    except Exception as e:
        logger.warning(f"Startup: Kamailio htable sync failed (non-fatal): {e}")

    yield
    # Shutdown
    await close_redis()


app = FastAPI(
    title=settings.app_name,
    description="Multi-tenant cloud PBX management API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS (configurable via ALLOWED_ORIGINS env var)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(tenants.router)
app.include_router(extensions.router)
app.include_router(trunks.router)
app.include_router(cdr.router)
app.include_router(calls.router)
app.include_router(admin.router)
app.include_router(blacklist.router)
