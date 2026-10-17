"""Add mandi, price_reading, farmer_mandi and crop_catalog.price_commodity.

Revision ID: 0009_market_prices
Revises: 0008_crop_sale
Create Date: 2026-10-17 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0009_market_prices"
down_revision: str | None = "0008_crop_sale"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

# crop_catalog name -> the mandi feed's commodity name (exact spelling). Rows
# are seeded by the admin endpoint, so this also covers databases that already
# have them; the seed endpoint sets the same values on a fresh database.
COMMODITIES = {
    "Soybeans": "Soyabean",
    "Wheat": "Wheat",
    "Rice": "Paddy(Common)",
    "Corn": "Maize",
    "Cotton": "Cotton",
    "Mustard": "Mustard",
}


def upgrade() -> None:
    op.add_column("crop_catalog", sa.Column("price_commodity", sa.String(100), nullable=True))

    op.create_table(
        "mandi",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("state", sa.String(100), nullable=False),
        sa.Column("district", sa.String(150), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.UniqueConstraint("state", "district", "name", name="uq_mandi_state_district_name"),
    )
    op.create_index("idx_mandi_district", "mandi", ["district"])

    op.create_table(
        "price_reading",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("mandi_id", sa.BigInteger(), sa.ForeignKey("mandi.id"), nullable=False),
        sa.Column("commodity", sa.String(100), nullable=False),
        sa.Column("variety", sa.String(100), nullable=False),
        sa.Column("grade", sa.String(100), nullable=False),
        sa.Column("price_date", sa.Date(), nullable=False),
        sa.Column("min_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("max_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("modal_price", sa.Numeric(10, 2), nullable=False),
        sa.UniqueConstraint(
            "mandi_id", "commodity", "variety", "grade", "price_date", name="uq_price_reading_key"
        ),
    )
    op.create_index(
        "idx_price_reading_lookup", "price_reading", ["mandi_id", "commodity", "price_date"]
    )
    op.create_index("idx_price_reading_date", "price_reading", ["price_date"])

    op.create_table(
        "farmer_mandi",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("farmer_id", sa.BigInteger(), sa.ForeignKey("farmer.id"), nullable=False),
        sa.Column("mandi_id", sa.BigInteger(), sa.ForeignKey("mandi.id"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint("farmer_id", "mandi_id", name="uq_farmer_mandi"),
    )
    op.create_index("idx_farmer_mandi_farmer_id", "farmer_mandi", ["farmer_id"])

    crop_catalog = sa.table(
        "crop_catalog", sa.column("name", sa.String), sa.column("price_commodity", sa.String)
    )
    for crop_name, commodity in COMMODITIES.items():
        op.execute(
            crop_catalog.update()
            .where(crop_catalog.c.name == crop_name)
            .values(price_commodity=commodity)
        )


def downgrade() -> None:
    op.drop_index("idx_farmer_mandi_farmer_id", table_name="farmer_mandi")
    op.drop_table("farmer_mandi")
    op.drop_index("idx_price_reading_date", table_name="price_reading")
    op.drop_index("idx_price_reading_lookup", table_name="price_reading")
    op.drop_table("price_reading")
    op.drop_index("idx_mandi_district", table_name="mandi")
    op.drop_table("mandi")
    op.drop_column("crop_catalog", "price_commodity")
