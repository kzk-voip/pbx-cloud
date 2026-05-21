"""Add global_ip_whitelist and tenant_ip_acl tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Global IP whitelist — IPs immune from pike/fail2ban
    op.create_table(
        "global_ip_whitelist",
        sa.Column("id", PG_UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("ip_address", sa.String(45), nullable=False, unique=True),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("created_by", PG_UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    # Per-tenant IP ACL — strict whitelist
    op.create_table(
        "tenant_ip_acl",
        sa.Column("id", PG_UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("tenant_id", PG_UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("tenant_id", "ip_address", name="uq_tenant_ip_acl"),
    )
    op.create_index("ix_tenant_ip_acl_tenant_id", "tenant_ip_acl", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_tenant_ip_acl_tenant_id")
    op.drop_table("tenant_ip_acl")
    op.drop_table("global_ip_whitelist")
