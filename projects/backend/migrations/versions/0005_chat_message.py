"""Add chat_message table: persisted assistant conversation per farmer.

Revision ID: 0005_chat_message
Revises: 0004_activity_history
Create Date: 2026-09-30 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_chat_message"
down_revision: str | None = "0004_activity_history"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chat_message",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column(
            "farmer_id",
            sa.BigInteger(),
            sa.ForeignKey("farmer.id"),
            nullable=False,
        ),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False, server_default="text"),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("idx_chat_message_farmer_id_id", "chat_message", ["farmer_id", "id"])


def downgrade() -> None:
    op.drop_index("idx_chat_message_farmer_id_id", table_name="chat_message")
    op.drop_table("chat_message")
