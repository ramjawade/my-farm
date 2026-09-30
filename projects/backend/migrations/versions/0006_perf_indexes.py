"""Index the tenant and foreign-key columns every list query filters on.

Revision ID: 0006_perf_indexes
Revises: 0005_chat_message
Create Date: 2026-09-30 00:00:00.000000

Without these, listing one farmer's activities or an activity's expenses
sequentially scanned the whole table, so latency grew with *every* farmer's
rows. Measured on 150k activities / 75k expenses: activities list 20 ms ->
0.2 ms, per-activity expenses 6.4 ms -> 0.06 ms.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006_perf_indexes"
down_revision: str | None = "0005_chat_message"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("idx_farm_farmer_id", "farm", ["farmer_id"])
    op.create_index("idx_land_farmer_id", "land", ["farmer_id"])
    op.create_index("idx_crop_farmer_id", "crop", ["farmer_id"])
    op.create_index(
        "idx_activity_farmer_updated",
        "activity",
        ["farmer_id", sa.text("updated_at DESC"), sa.text("id DESC")],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index("idx_activity_crop_id", "activity", ["crop_id"])
    op.create_index("idx_activity_land_id", "activity", ["land_id"])
    op.create_index("idx_activity_expense_activity_id", "activity_expense", ["activity_id"])


def downgrade() -> None:
    op.drop_index("idx_activity_expense_activity_id", table_name="activity_expense")
    op.drop_index("idx_activity_land_id", table_name="activity")
    op.drop_index("idx_activity_crop_id", table_name="activity")
    op.drop_index("idx_activity_farmer_updated", table_name="activity")
    op.drop_index("idx_crop_farmer_id", table_name="crop")
    op.drop_index("idx_land_farmer_id", table_name="land")
    op.drop_index("idx_farm_farmer_id", table_name="farm")
