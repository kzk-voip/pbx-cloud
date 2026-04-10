"""Add users table and seed admin

Revision ID: 0001
Revises: None
Create Date: 2026-04-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Pre-computed bcrypt hash for "admin" password
# Generated with: passlib.hash.bcrypt.hash("admin")
ADMIN_PASSWORD_HASH = "$2b$12$LJ3m4ys3LzfRaQHsYJhUxuVg2OKNwFCeL8I3nqBTvEkQD1cN.WcO6"


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("username", sa.String(80), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Seed super_admin user (username: admin, password: admin)
    op.execute(
        f"""
        INSERT INTO users (username, password_hash, role)
        VALUES ('admin', '{ADMIN_PASSWORD_HASH}', 'super_admin')
        """
    )


def downgrade() -> None:
    op.drop_table("users")
