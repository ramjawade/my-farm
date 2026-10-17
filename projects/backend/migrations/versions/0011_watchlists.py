"""Add watchlist and watchlist_item: named lists of crop-at-market items.

Revision ID: 0011_watchlists
Revises: 0010_crop_catalog
Create Date: 2026-10-17 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0011_watchlists"
down_revision: str | None = "0010_crop_catalog"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "watchlist",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("farmer_id", sa.BigInteger(), sa.ForeignKey("farmer.id"), nullable=False),
        sa.Column("name", sa.String(30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("idx_watchlist_farmer_id", "watchlist", ["farmer_id"])
    op.execute("CREATE UNIQUE INDEX uq_watchlist_farmer_name ON watchlist (farmer_id, lower(name))")

    op.create_table(
        "watchlist_item",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column(
            "watchlist_id",
            sa.BigInteger(),
            sa.ForeignKey("watchlist.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "crop_catalog_id", sa.BigInteger(), sa.ForeignKey("crop_catalog.id"), nullable=False
        ),
        sa.Column("mandi_id", sa.BigInteger(), sa.ForeignKey("mandi.id"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "watchlist_id", "crop_catalog_id", "mandi_id", name="uq_watchlist_item"
        ),
    )
    op.create_index("idx_watchlist_item_watchlist_id", "watchlist_item", ["watchlist_id"])


def downgrade() -> None:
    op.drop_index("idx_watchlist_item_watchlist_id", table_name="watchlist_item")
    op.drop_table("watchlist_item")
    op.execute("DROP INDEX IF EXISTS uq_watchlist_farmer_name")
    op.drop_index("idx_watchlist_farmer_id", table_name="watchlist")
    op.drop_table("watchlist")
