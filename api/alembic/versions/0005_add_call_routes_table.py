"""Add call_routes table

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-19
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "call_routes",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", PG_UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("pattern", sa.String(100), nullable=False),
        sa.Column("trunk_id", PG_UUID(as_uuid=True), sa.ForeignKey("trunks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prefix_strip", sa.Integer, nullable=False, server_default="0"),
        sa.Column("prefix_add", sa.String(40), nullable=False, server_default="''"),
        sa.Column("priority", sa.Integer, nullable=False, server_default="10"),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade():
    op.drop_table("call_routes")
