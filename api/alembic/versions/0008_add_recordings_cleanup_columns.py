"""Add recordings cleanup columns to tenants table

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-26
"""

from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("recordings_cleanup_days", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tenants",
        sa.Column("recordings_cleanup_pct", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tenants",
        sa.Column("recordings_storage_limit_mb", sa.Integer(), nullable=False, server_default="100"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "recordings_storage_limit_mb")
    op.drop_column("tenants", "recordings_cleanup_pct")
    op.drop_column("tenants", "recordings_cleanup_days")
