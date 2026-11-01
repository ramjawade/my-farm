"""Add sale columns to activity and copy crop_sale rows into Sale activities.

A sale becomes an activity of type Sale. Existing live `crop_sale` rows are
copied as Completed Sale activities (tagged in `activity_meta` so downgrade can
remove exactly those). The `crop_sale` table is left in place as a rollback copy;
a later change drops it.

Revision ID: 0012_sale_activity_columns
Revises: 0011_watchlists
Create Date: 2026-11-01 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0012_sale_activity_columns"
down_revision: str | None = "0011_watchlists"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

MIGRATED_FROM = "crop_sale"


def upgrade() -> None:
    op.add_column("activity", sa.Column("sale_quantity", sa.Numeric(10, 2), nullable=True))
    op.add_column("activity", sa.Column("sale_unit", sa.String(50), nullable=True))
    op.add_column("activity", sa.Column("sale_rate", sa.Numeric(10, 2), nullable=True))
    op.add_column("activity", sa.Column("sale_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column("activity", sa.Column("sale_buyer", sa.String(255), nullable=True))

    # Season uses the app's month rule: Jun-Oct Kharif, Apr-May Zaid, otherwise Rabi.
    op.execute(
        f"""
        INSERT INTO activity (
            farmer_id, crop_id, land_id, activity_type_id, date, season, status, notes,
            activity_meta, sale_quantity, sale_unit, sale_rate, sale_amount, sale_buyer,
            created_at, updated_at
        )
        SELECT
            c.farmer_id, s.crop_id, c.land_id, t.id,
            to_char(s.sold_on, 'YYYY-MM-DD'),
            CASE
                WHEN extract(month FROM s.sold_on) BETWEEN 6 AND 10 THEN 'Kharif'
                WHEN extract(month FROM s.sold_on) IN (4, 5) THEN 'Zaid'
                ELSE 'Rabi'
            END,
            'Completed', s.notes,
            jsonb_build_object('migrated_from', '{MIGRATED_FROM}', 'crop_sale_id', s.id),
            s.quantity, s.unit, s.rate, s.amount, s.buyer,
            s.created_at, s.updated_at
        FROM crop_sale s
        JOIN crop c ON c.id = s.crop_id
        JOIN activity_type t ON t.name = 'Sale'
        WHERE s.deleted_at IS NULL
        """
    )


def downgrade() -> None:
    for child in ("activity_history", "activity_expense", "activity_attachment"):
        op.execute(
            f"""
            DELETE FROM {child} WHERE activity_id IN (
                SELECT id FROM activity WHERE activity_meta->>'migrated_from' = '{MIGRATED_FROM}'
            )
            """
        )
    op.execute(
        f"DELETE FROM activity WHERE activity_meta->>'migrated_from' = '{MIGRATED_FROM}'"
    )
    op.drop_column("activity", "sale_buyer")
    op.drop_column("activity", "sale_amount")
    op.drop_column("activity", "sale_rate")
    op.drop_column("activity", "sale_unit")
    op.drop_column("activity", "sale_quantity")
