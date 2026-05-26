"""Add ring_groups and ring_group_members tables

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create ring_groups table
    op.create_table(
        "ring_groups",
        sa.Column("id", PG_UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("tenant_id", PG_UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("number", sa.String(length=20), nullable=False),
        sa.Column("strategy", sa.String(length=50), server_default="ringall", nullable=False),
        sa.Column("timeout", sa.Integer(), server_default="30", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "number", name="uq_tenant_ring_group_number"),
    )
    op.create_index("ix_ring_groups_tenant_id", "ring_groups", ["tenant_id"])

    # 2. Create ring_group_members table
    op.create_table(
        "ring_group_members",
        sa.Column("id", PG_UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("ring_group_id", PG_UUID(as_uuid=True), sa.ForeignKey("ring_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("extension_id", PG_UUID(as_uuid=True), sa.ForeignKey("extensions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("priority", sa.Integer(), server_default="0", nullable=False),
        sa.UniqueConstraint("ring_group_id", "extension_id", name="uq_ring_group_extension"),
    )
    op.create_index("ix_ring_group_members_ring_group_id", "ring_group_members", ["ring_group_id"])


def downgrade() -> None:
    op.drop_index("ix_ring_group_members_ring_group_id")
    op.drop_table("ring_group_members")
    op.drop_index("ix_ring_groups_tenant_id")
    op.drop_table("ring_groups")
