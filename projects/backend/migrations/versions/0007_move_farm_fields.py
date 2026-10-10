"""Move water source to the land and irrigation / farming method to the crop.

Revision ID: 0007_move_farm_fields
Revises: 0006_perf_indexes
Create Date: 2026-10-10 00:00:00.000000

The farm columns stay for now; a later change drops them.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007_move_farm_fields"
down_revision: str | None = "0006_perf_indexes"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("land", sa.Column("water_source", sa.String(255), nullable=True))
    op.add_column("crop", sa.Column("irrigation_type", sa.String(255), nullable=True))
    op.add_column("crop", sa.Column("farming_method", sa.String(255), nullable=True))
    op.execute(
        "UPDATE land SET water_source = farm.water_source "
        "FROM farm WHERE land.farm_id = farm.id"
    )
    op.execute(
        "UPDATE crop SET irrigation_type = farm.irrigation_type, "
        "farming_method = farm.farming_method "
        "FROM land JOIN farm ON land.farm_id = farm.id "
        "WHERE crop.land_id = land.id"
    )


def downgrade() -> None:
    op.drop_column("crop", "farming_method")
    op.drop_column("crop", "irrigation_type")
    op.drop_column("land", "water_source")
