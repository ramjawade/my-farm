"""Add activity_history table: audit-trail entries for activity/expense events.

Revision ID: 0004_activity_history
Revises: 0003_reference_tables
Create Date: 2026-09-12 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_activity_history"
down_revision: str | None = "0003_reference_tables"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "activity_history",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column(
            "activity_id",
            sa.BigInteger(),
            sa.ForeignKey("activity.id"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("detail", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_activity_history_activity_id", "activity_history", ["activity_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_activity_history_activity_id", table_name="activity_history")
    op.drop_table("activity_history")
