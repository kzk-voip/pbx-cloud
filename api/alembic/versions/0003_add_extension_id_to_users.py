"""Add extension_id to users table

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-19
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "extension_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("extensions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("users", "extension_id")
