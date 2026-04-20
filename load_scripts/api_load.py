"""
Locust load test for PBX Cloud API.

Simulates realistic admin panel traffic:
  - Login (once per user)
  - Browse tenants list (most frequent)
  - View tenant details
  - Query CDR history (heavy DB operation)

Usage:
    pip install locust
    locust -f load_scripts/api_load.py --host http://localhost:8000

    Then open http://localhost:8089 and configure:
      - Number of users: 50
      - Spawn rate: 5
      - Run for: 60s

Prerequisite:
    Seed a super_admin user in the database first:
      INSERT INTO users (username, password_hash, role)
      VALUES ('admin', '<bcrypt_hash_of_securepassword>', 'super_admin');
"""

import logging

from locust import HttpUser, between, task

logger = logging.getLogger(__name__)


class PBXAdminUser(HttpUser):
    """Simulates an admin user interacting with the PBX Cloud API."""

    wait_time = between(1, 3)
    host = "http://localhost:8000"

    def on_start(self):
        """Login once and cache the JWT token + a known tenant ID."""
        resp = self.client.post("/auth/login", json={
            "username": "admin",
            "password": "securepassword",
        })
        if resp.status_code != 200:
            logger.error("Login failed (%s): %s", resp.status_code, resp.text)
            self.token = ""
            self.headers = {}
            self.tenant_id = None
            return

        data = resp.json()
        self.token = data["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

        # Fetch the first available tenant for scoped API calls
        tenants_resp = self.client.get("/tenants", headers=self.headers)
        if tenants_resp.status_code == 200:
            items = tenants_resp.json().get("items", [])
            self.tenant_id = items[0]["id"] if items else None
        else:
            self.tenant_id = None

    @task(5)
    def list_tenants(self):
        """Most common action: admin browses tenant list."""
        if self.token:
            self.client.get("/tenants", headers=self.headers)

    @task(3)
    def get_tenant_detail(self):
        """Admin opens a specific tenant."""
        if self.token and self.tenant_id:
            self.client.get(
                f"/tenants/{self.tenant_id}",
                headers=self.headers,
            )

    @task(2)
    def query_cdr(self):
        """Admin queries CDR — heavier DB operation (test p95 latency)."""
        if self.token and self.tenant_id:
            self.client.get(
                f"/tenants/{self.tenant_id}/cdr",
                headers=self.headers,
            )

    @task(1)
    def list_extensions(self):
        """Admin views extensions of a tenant."""
        if self.token and self.tenant_id:
            self.client.get(
                f"/tenants/{self.tenant_id}/extensions",
                headers=self.headers,
            )
