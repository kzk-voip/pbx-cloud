"""
Stress Test Data Generator — automates provisioning of a stress test tenant and 50 extensions,
then generates the SIPp injection file (users.csv).
"""

import asyncio
import os
import sys
import logging
from sqlalchemy import select
from pathlib import Path

# Setup sys.path to allow imports from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import async_session
from app.models.tenant import Tenant
from app.models.extension import Extension
from app.models.user import User
from app.models.ara import PjsipEndpoint, PjsipAuth, PjsipAor
from app.services.auth_service import hash_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)

STRESS_TENANT_SLUG = "stress"
STRESS_TENANT_DOMAIN = "stress.pbx.local"
STRESS_TENANT_NAME = "Stress Test Tenant"

async def main():
    logger.info("Initializing stress test provisioning...")
    
    async with async_session() as db:
        # 1. Create or get stress tenant
        result = await db.execute(select(Tenant).where(Tenant.slug == STRESS_TENANT_SLUG))
        tenant = result.scalar_one_or_none()
        
        if not tenant:
            logger.info(f"Creating stress tenant '{STRESS_TENANT_SLUG}'...")
            tenant = Tenant(
                slug=STRESS_TENANT_SLUG,
                domain=STRESS_TENANT_DOMAIN,
                name=STRESS_TENANT_NAME,
                max_extensions=100,
                max_concurrent_calls=100,
                is_active=True,
                codecs="ulaw,alaw"
            )
            db.add(tenant)
            await db.commit()
            await db.refresh(tenant)
            logger.info(f"Stress tenant '{STRESS_TENANT_SLUG}' created successfully with ID {tenant.id}")
        else:
            logger.info(f"Stress tenant '{STRESS_TENANT_SLUG}' already exists (ID {tenant.id})")
            
        # 2. Generate 50 extensions (from 101 to 150)
        extensions_data = []
        for i in range(101, 151):
            ext_num = str(i)
            sip_id = f"stress_{ext_num}"
            sip_password = f"stressPass_{ext_num}_secure!" # stable secure password based on extension number
            
            # Check if extension already exists
            ext_result = await db.execute(
                select(Extension).where(Extension.tenant_id == tenant.id, Extension.extension_number == ext_num)
            )
            extension = ext_result.scalar_one_or_none()
            
            if not extension:
                logger.info(f"Creating extension {ext_num}...")
                
                # Metadata
                extension = Extension(
                    tenant_id=tenant.id,
                    extension_number=ext_num,
                    display_name=f"Stress Ext {ext_num}"
                )
                db.add(extension)
                
                # AOR
                aor = PjsipAor(
                    id=sip_id,
                    tenant_id=tenant.id,
                    max_contacts=1,
                    remove_existing=True,
                    support_path=True,
                    qualify_frequency=30
                )
                db.add(aor)
                
                # Auth
                auth = PjsipAuth(
                    id=sip_id,
                    tenant_id=tenant.id,
                    auth_type="userpass",
                    username=sip_id,
                    password=sip_password
                )
                db.add(auth)
                
                # Endpoint
                callerid = f'"Stress Ext {ext_num}" <{ext_num}>'
                endpoint = PjsipEndpoint(
                    id=sip_id,
                    tenant_id=tenant.id,
                    transport="transport-udp",
                    aors=sip_id,
                    auth=sip_id,
                    context="from-kamailio",
                    disallow="all",
                    allow="ulaw",
                    direct_media=False,
                    force_rport=True,
                    rewrite_contact=True,
                    rtp_symmetric=True,
                    dtmf_mode="rfc4733",
                    callerid=callerid
                )
                db.add(endpoint)
                
                # Web user
                try:
                    web_user = User(
                        tenant_id=tenant.id,
                        username=sip_id,
                        password_hash=hash_password(sip_password),
                        role="user",
                        is_active=True
                    )
                    db.add(web_user)
                except Exception as ex:
                    # Ignore if user already exists
                    pass
                
                await db.commit()
                logger.info(f"Extension {ext_num} created successfully.")
            else:
                # Retrieve password from Auth table
                auth_result = await db.execute(
                    select(PjsipAuth).where(PjsipAuth.id == sip_id)
                )
                auth_obj = auth_result.scalar_one_or_none()
                if auth_obj:
                    sip_password = auth_obj.password
                
            extensions_data.append((sip_id, STRESS_TENANT_DOMAIN, sip_password))
            
        # 3. Always sync stress domain to Kamailio htable dynamically
        try:
            from app.services import kamailio_service
            synced = await kamailio_service.add_tenant_domain(STRESS_TENANT_DOMAIN, STRESS_TENANT_SLUG)
            if synced:
                logger.info("Successfully synced/confirmed stress domain in Kamailio htable.")
            else:
                logger.warning("Failed to sync stress domain to Kamailio htable.")
        except Exception as e:
            logger.error(f"Error syncing domain to Kamailio: {e}")

        # 4. Write users.csv file
        csv_lines = [
            "SEQUENTIAL",
            "username;domain;password"
        ]
        for sip_id, domain, pwd in extensions_data:
            csv_lines.append(f"{sip_id};{domain};{pwd}")
            
        csv_content = "\n".join(csv_lines) + "\n"
        
        # Determine target file
        # Check if /sipp volume is mounted in the container
        sipp_dir = Path("/sipp")
        if sipp_dir.exists() and sipp_dir.is_dir():
            target_path = sipp_dir / "users.csv"
        else:
            target_path = Path("/app/users.csv")
            
        try:
            target_path.write_text(csv_content)
            logger.info(f"Successfully generated injection file at: {target_path}")
        except Exception as e:
            logger.error(f"Failed to write injection file: {e}")
            print("\n--- GENERATED CSV CONTENT START ---")
            print(csv_content)
            print("--- GENERATED CSV CONTENT END ---\n")

if __name__ == "__main__":
    asyncio.run(main())
