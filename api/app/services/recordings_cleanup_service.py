"""
Recordings Deletion & Storage Cleanup service — manages automatic space cleanup for call recordings.
"""

import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.services import event_service

logger = logging.getLogger(__name__)

RECORDINGS_DIR = Path(os.getenv("RECORDINGS_DIR", "/recordings"))


def get_tenant_storage_used_bytes(slug: str) -> int:
    """
    Recursively calculate the total size in bytes of all files in the tenant's recordings directory.
    """
    tenant_dir = RECORDINGS_DIR / slug
    if not tenant_dir.exists() or not tenant_dir.is_dir():
        return 0

    total_size = 0
    try:
        for dirpath, _, filenames in os.walk(tenant_dir):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if os.path.exists(fp):
                    total_size += os.path.getsize(fp)
    except Exception as exc:
        logger.warning(f"Error calculating storage size for tenant {slug}: {exc}")
    return total_size


async def cleanup_tenant_recordings(db: AsyncSession, tenant: Tenant) -> None:
    """
    Run age-based and storage-limit-based cleanup for a single tenant.
    Logs deletions in Tenant Events for transparency.
    """
    tenant_dir = RECORDINGS_DIR / tenant.slug
    if not tenant_dir.exists() or not tenant_dir.is_dir():
        return

    # 1. Collect all WAV files
    wav_files = []
    try:
        for f in tenant_dir.glob("*.wav"):
            if f.is_file():
                try:
                    stat = f.stat()
                    # Store tuple: (Path, size_bytes, mtime_timestamp)
                    wav_files.append((f, stat.st_size, stat.st_mtime))
                except Exception as e:
                    logger.warning(f"Could not stat file {f}: {e}")
    except Exception as exc:
        logger.error(f"Error scanning recordings directory for {tenant.slug}: {exc}")
        return

    if not wav_files:
        return

    # Sort files by modification time (oldest first)
    wav_files.sort(key=lambda x: x[2])

    deleted_count_days = 0
    freed_bytes_days = 0
    now_ts = datetime.now(timezone.utc).timestamp()

    # 2. Cleanup by age (Days Threshold)
    if tenant.recordings_cleanup_days and tenant.recordings_cleanup_days > 0:
        days_in_seconds = tenant.recordings_cleanup_days * 86400
        remaining_files = []
        for f, size, mtime in wav_files:
            if (now_ts - mtime) > days_in_seconds:
                try:
                    f.unlink()
                    deleted_count_days += 1
                    freed_bytes_days += size
                except Exception as e:
                    logger.error(f"Failed to delete old recording {f}: {e}")
            else:
                remaining_files.append((f, size, mtime))
        wav_files = remaining_files

    deleted_count_space = 0
    freed_bytes_space = 0

    # 3. Cleanup by Storage Quota & Threshold percentage
    if (
        tenant.recordings_cleanup_pct
        and tenant.recordings_cleanup_pct > 0
        and tenant.recordings_storage_limit_mb
        and tenant.recordings_storage_limit_mb > 0
    ):
        limit_bytes = tenant.recordings_storage_limit_mb * 1024 * 1024
        threshold_bytes = limit_bytes * (tenant.recordings_cleanup_pct / 100)

        # Calculate current total usage
        current_bytes = sum(size for _, size, _ in wav_files)

        if current_bytes > threshold_bytes:
            logger.info(
                f"Tenant {tenant.slug} storage ({current_bytes} B) exceeds threshold ({threshold_bytes} B). Cleaning oldest recordings..."
            )
            for f, size, mtime in wav_files:
                if current_bytes <= threshold_bytes:
                    break
                try:
                    f.unlink()
                    current_bytes -= size
                    deleted_count_space += 1
                    freed_bytes_space += size
                except Exception as e:
                    logger.error(f"Failed to delete recording for quota limit {f}: {e}")

    # 4. Log events if any deletions happened
    freed_mb_total = round((freed_bytes_days + freed_bytes_space) / (1024 * 1024), 2)
    files_deleted_total = deleted_count_days + deleted_count_space

    if files_deleted_total > 0:
        logger.info(
            f"Recordings cleanup for {tenant.slug}: deleted {files_deleted_total} files, freed {freed_mb_total} MB"
        )
        try:
            await event_service.log_event(
                db,
                tenant.id,
                "recordings_cleanup",
                source="system",
                details={
                    "files_deleted_total": files_deleted_total,
                    "freed_mb": freed_mb_total,
                    "deleted_by_age": deleted_count_days,
                    "deleted_by_quota": deleted_count_space,
                },
            )
            await db.commit()
        except Exception as exc:
            logger.error(f"Failed to log recordings_cleanup event for {tenant.slug}: {exc}")
            await db.rollback()


async def cleanup_all_tenants_recordings(db: AsyncSession) -> None:
    """
    Query all tenants and execute cleanup check for each.
    """
    logger.info("Starting global recordings cleanup job across all tenants...")
    try:
        result = await db.execute(select(Tenant).where(Tenant.is_active == True))
        tenants = result.scalars().all()
        for tenant in tenants:
            await cleanup_tenant_recordings(db, tenant)
    except Exception as exc:
        logger.error(f"Failed to run global recordings cleanup: {exc}")


async def schedule_recordings_cleanup_task(db_session_factory) -> None:
    """
    Background task to run recordings cleanup exactly twice a day: at 00:00 UTC and 12:00 UTC.
    Calculates sleep seconds dynamically.
    """
    import asyncio
    from datetime import timedelta

    logger.info("Recordings cleanup background scheduler active.")
    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            
            # Target times are today 00:00 UTC and today 12:00 UTC
            target_1 = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
            target_2 = now_utc.replace(hour=12, minute=0, second=0, microsecond=0)
            
            # Find next target time in the future
            candidates = []
            for t in (target_1, target_2):
                if t > now_utc:
                    candidates.append(t)
                else:
                    candidates.append(t + timedelta(days=1))
            
            next_run = min(candidates)
            sleep_seconds = (next_run - now_utc).total_seconds()
            logger.info(f"Scheduled next recordings cleanup at {next_run} UTC (sleeping for {sleep_seconds:.1f} seconds)")
            
            await asyncio.sleep(sleep_seconds)
            
            # Double-check we are actually past next_run to prevent early wakeup loop
            now_after_sleep = datetime.now(timezone.utc)
            if now_after_sleep < next_run:
                extra_sleep = (next_run - now_after_sleep).total_seconds() + 1.0
                logger.info(f"Woke up slightly early. Sleeping for an extra {extra_sleep:.2f} seconds.")
                await asyncio.sleep(extra_sleep)
            
            # Execute cleanup!
            logger.info("Executing scheduled recordings cleanup now...")
            async with db_session_factory() as db:
                await cleanup_all_tenants_recordings(db)
                
        except asyncio.CancelledError:
            logger.info("Recordings cleanup background task cancelled.")
            break
        except Exception as exc:
            logger.error(f"Error in recordings cleanup scheduler: {exc}")
            # sleep 60 seconds on error to prevent spinning
            await asyncio.sleep(60)

