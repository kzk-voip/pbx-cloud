"""
AMI service — async Asterisk Manager Interface client.

Connects to Asterisk AMI via TCP, authenticates, and executes
management actions (e.g., listing active channels).
"""

import asyncio
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class AMIClient:
    """
    Lightweight async AMI client.
    Creates a new TCP connection for each request (stateless pattern).
    """

    def __init__(self):
        self.host = settings.ami_host
        self.port = settings.ami_port
        self.username = settings.ami_username
        self.password = settings.ami_password

    async def _connect_and_login(self) -> tuple[asyncio.StreamReader, asyncio.StreamWriter] | None:
        """Open TCP connection and authenticate with AMI."""
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port),
                timeout=5.0,
            )

            # Read AMI banner
            banner = await asyncio.wait_for(reader.readline(), timeout=3.0)
            logger.debug(f"AMI banner: {banner.decode().strip()}")

            # Send Login action
            login_cmd = (
                f"Action: Login\r\n"
                f"Username: {self.username}\r\n"
                f"Secret: {self.password}\r\n"
                f"\r\n"
            )
            writer.write(login_cmd.encode())
            await writer.drain()

            # Read login response
            response = await self._read_response(reader)
            if response.get("Response") != "Success":
                logger.error(f"AMI login failed: {response}")
                writer.close()
                await writer.wait_closed()
                return None

            return reader, writer

        except Exception as e:
            logger.error(f"AMI connection failed: {e}")
            return None

    async def _read_response(self, reader: asyncio.StreamReader) -> dict:
        """Read a single AMI response block (terminated by blank line)."""
        result = {}
        try:
            while True:
                line = await asyncio.wait_for(reader.readline(), timeout=5.0)
                text = line.decode("utf-8", errors="replace").strip()
                if not text:
                    break
                if ": " in text:
                    key, value = text.split(": ", 1)
                    result[key] = value
        except asyncio.TimeoutError:
            pass
        return result

    async def _read_all_events(self, reader: asyncio.StreamReader, complete_event: str) -> list[dict]:
        """Read multiple AMI event blocks until the complete event is received."""
        events = []
        try:
            while True:
                event = await self._read_response(reader)
                if not event:
                    continue
                events.append(event)
                if event.get("Event") == complete_event or event.get("EventList") == "Complete":
                    break
        except asyncio.TimeoutError:
            pass
        return events

    async def _logoff(self, writer: asyncio.StreamWriter):
        """Send Logoff action and close connection."""
        try:
            writer.write(b"Action: Logoff\r\n\r\n")
            await writer.drain()
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass

    async def get_active_channels(self, tenant_slug: str | None = None) -> list[dict]:
        """
        Get active channels from Asterisk via AMI CoreShowChannels.
        Optionally filter by tenant slug (matches accountcode or channel name prefix).
        """
        conn = await self._connect_and_login()
        if conn is None:
            return []

        reader, writer = conn

        try:
            # Send CoreShowChannels
            cmd = "Action: CoreShowChannels\r\n\r\n"
            writer.write(cmd.encode())
            await writer.drain()

            # Read initial response
            initial = await self._read_response(reader)

            # Read channel events until CoreShowChannelsComplete
            events = await self._read_all_events(reader, "CoreShowChannelsComplete")

            channels = []
            for event in events:
                if event.get("Event") != "CoreShowChannel":
                    continue

                channel_info = {
                    "channel": event.get("Channel", ""),
                    "context": event.get("Context", ""),
                    "extension": event.get("Exten", ""),
                    "state": event.get("ChannelStateDesc", ""),
                    "callerid_num": event.get("CallerIDNum", ""),
                    "callerid_name": event.get("CallerIDName", ""),
                    "connected_num": event.get("ConnectedLineNum", ""),
                    "connected_name": event.get("ConnectedLineName", ""),
                    "accountcode": event.get("AccountCode", ""),
                    "duration": event.get("Duration", ""),
                    "bridged_to": event.get("BridgedChannel", ""),
                    "application": event.get("Application", ""),
                    "application_data": event.get("ApplicationData", ""),
                }
                channels.append(channel_info)

            # Filter by tenant if requested
            if tenant_slug:
                channels = [
                    ch for ch in channels
                    if ch["accountcode"] == tenant_slug
                    or ch["channel"].startswith(f"PJSIP/{tenant_slug}_")
                ]

            return channels

        except Exception as e:
            logger.error(f"AMI CoreShowChannels failed: {e}")
            return []
        finally:
            await self._logoff(writer)


# Module-level singleton
ami_client = AMIClient()


async def get_active_calls(tenant_slug: str | None = None) -> list[dict]:
    """
    Get active calls, optionally filtered by tenant.
    Convenience wrapper around AMIClient.
    """
    return await ami_client.get_active_channels(tenant_slug)
