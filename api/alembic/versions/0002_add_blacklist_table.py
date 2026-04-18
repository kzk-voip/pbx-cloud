"""Add number blacklist table

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "number_blacklist",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", PG_UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pattern", sa.String(64), nullable=False),
        sa.Column("reason", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("ix_number_blacklist_tenant", "number_blacklist", ["tenant_id"])
    op.create_index("ix_number_blacklist_pattern", "number_blacklist", ["tenant_id", "pattern"], unique=True)

    # Add allow_international column to tenants table
    op.add_column("tenants", sa.Column("allow_international", sa.Boolean(), server_default=sa.text("false"), nullable=False))


def downgrade():
    op.drop_column("tenants", "allow_international")
    op.drop_index("ix_number_blacklist_pattern")
    op.drop_index("ix_number_blacklist_tenant")
    op.drop_table("number_blacklist")
