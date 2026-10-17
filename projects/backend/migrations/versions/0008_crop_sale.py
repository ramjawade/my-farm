"""Add crop_sale table: sales of produce recorded against a crop.

Revision ID: 0008_crop_sale
Revises: 0007_move_farm_fields
Create Date: 2026-10-17 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008_crop_sale"
down_revision: str | None = "0007_move_farm_fields"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "crop_sale",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("crop_id", sa.BigInteger(), sa.ForeignKey("crop.id"), nullable=False),
        sa.Column("sold_on", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.Column("rate", sa.Numeric(10, 2), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("buyer", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_crop_sale_crop_id", "crop_sale", ["crop_id"])


def downgrade() -> None:
    op.drop_index("idx_crop_sale_crop_id", table_name="crop_sale")
    op.drop_table("crop_sale")
