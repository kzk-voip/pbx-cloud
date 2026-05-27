import asyncio
import os
import sys
import logging

# Add current folder to sys.path to allow imports from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import async_session
from app.services.recordings_cleanup_service import cleanup_all_tenants_recordings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("manual_cleanup")

async def main():
    logger.info("Starting manual trigger of recordings cleanup...")
    async with async_session() as db:
        await cleanup_all_tenants_recordings(db)
    logger.info("Manual recordings cleanup completed.")

if __name__ == "__main__":
    asyncio.run(main())
