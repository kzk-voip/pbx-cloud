"""
PBX Cloud — FastAPI Application Entry Point
"""

import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.context import client_ip_var
from app.database import async_session
from app.redis import init_redis, close_redis
from app.routers import health, auth, tenants, extensions, trunks, cdr, calls, admin, blacklist, ws, events, reports, inbound_rules, call_routes, users, internal, ip_whitelist, tenant_ip_acl, assistant
from app.services import kamailio_service

# Configure logging for all app.* loggers
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)


from prometheus_client import Gauge
import asyncio
from app.services.ami_service import AMIClient

asterisk_active_channels_gauge = Gauge(
    "asterisk_channels", 
    "Asterisk Active Channels", 
    ["node"] # We use 'node' label instead of 'job' to avoid prometheus renaming
)

async def collect_asterisk_metrics():
    """Background task to poll asterisk nodes and expose metrics via prometheus"""
    client1 = AMIClient()
    client1.port = 5038
    client1.host = "127.0.0.1"
    
    client2 = AMIClient()
    client2.port = 5039
    client2.host = "127.0.0.1"
    
    while True:
        try:
            ch1 = await client1.get_active_channels()
            asterisk_active_channels_gauge.labels(node="asterisk-1").set(len(ch1))
            
            ch2 = await client2.get_active_channels()
            asterisk_active_channels_gauge.labels(node="asterisk-2").set(len(ch2))
        except Exception as e:
            logger.warning(f"Metrics collection error: {e}")
            
        await asyncio.sleep(5)

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

    # Sync global IP whitelist to Kamailio htable
    try:
        async with async_session() as db:
            synced = await kamailio_service.sync_global_whitelist_from_db(db)
            logger.info(f"Startup: synced {synced} IPs to Kamailio whitelist")
    except Exception as e:
        logger.warning(f"Startup: whitelist sync failed (non-fatal): {e}")

    # Sync tenant IP ACLs to Kamailio htable
    try:
        async with async_session() as db:
            synced = await kamailio_service.sync_tenant_acls_from_db(db)
            logger.info(f"Startup: synced {synced} tenant ACL entries")
    except Exception as e:
        logger.warning(f"Startup: tenant ACL sync failed (non-fatal): {e}")

    # Start custom prometheus metrics collector
    metrics_task = asyncio.create_task(collect_asterisk_metrics())

    yield
    
    # Shutdown
    metrics_task.cancel()
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

@app.middleware("http")
async def ip_blacklist_middleware(request: Request, call_next):
    path = request.url.path
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)

    token = client_ip_var.set(ip)
    try:
        if path.startswith("/internal") or path.startswith("/docs") or path.startswith("/redoc") or path == "/metrics":
            return await call_next(request)

        try:
            if ip and await kamailio_service.is_ip_blacklisted(ip):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Your IP has been blocked."}
                )
        except Exception as e:
            logger.error(f"IP blacklist check failed: {e}")

        return await call_next(request)
    finally:
        client_ip_var.reset(token)

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
app.include_router(ws.router)
app.include_router(events.router)
app.include_router(reports.router)
app.include_router(inbound_rules.router)
app.include_router(call_routes.router)
app.include_router(users.router)
app.include_router(internal.router)
app.include_router(ip_whitelist.router)
app.include_router(tenant_ip_acl.router)
app.include_router(assistant.router)

from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app)
