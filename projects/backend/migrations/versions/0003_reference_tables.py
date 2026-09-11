"""Convert all IDs to numeric BIGINT; add season and crop_stage reference tables.

Revision ID: 0003_reference_tables
Revises: 0002_farmer_pin_hash
Create Date: 2026-09-12 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_reference_tables"
down_revision: str | None = "0002_farmer_pin_hash"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Create season table with bigint id
    op.create_table(
        "season",
        sa.Column("id", sa.BigInteger(), nullable=False, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_season_name"),
    )

    # Create crop_stage table with bigint id
    op.create_table(
        "crop_stage",
        sa.Column("id", sa.BigInteger(), nullable=False, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_crop_stage_name"),
    )

    # Convert reference tables to bigint
    # activity_type
    op.drop_constraint("activity_type_pkey", "activity_type", type_="primary")
    op.drop_column("activity_type", "id")
    op.add_column("activity_type", sa.Column("id", sa.BigInteger(), nullable=False, autoincrement=True))
    op.create_primary_key("activity_type_pkey", "activity_type", ["id"])

    # expense_category
    op.drop_constraint("expense_category_pkey", "expense_category", type_="primary")
    op.drop_column("expense_category", "id")
    op.add_column("expense_category", sa.Column("id", sa.BigInteger(), nullable=False, autoincrement=True))
    op.create_primary_key("expense_category_pkey", "expense_category", ["id"])

    # crop_catalog
    op.drop_constraint("crop_catalog_pkey", "crop_catalog", type_="primary")
    op.drop_column("crop_catalog", "id")
    op.add_column("crop_catalog", sa.Column("id", sa.BigInteger(), nullable=False, autoincrement=True))
    op.create_primary_key("crop_catalog_pkey", "crop_catalog", ["id"])

    # Convert tenant-scoped tables: convert FKs first, then IDs
    # Update activity_type_id FK in activity (reference)
    op.alter_column("activity", "activity_type_id", existing_type=sa.UUID(), type_=sa.BigInteger())

    # Update expense_category_id FK in activity_expense (reference)
    op.alter_column("activity_expense", "expense_category_id", existing_type=sa.UUID(), type_=sa.BigInteger())

    # Update crop_catalog_id FK in crop (reference)
    op.alter_column("crop", "crop_catalog_id", existing_type=sa.UUID(), type_=sa.BigInteger())

    # Update crop_catalog_id FK in farm_crop (reference)
    op.alter_column("farm_crop", "crop_catalog_id", existing_type=sa.UUID(), type_=sa.BigInteger())

    # Now convert all tenant-scoped entity IDs: farmer, farm, land, crop, activity, etc.
    tables_to_convert = [
        ("farmer", []),  # farmer has no UUID FK deps
        ("farm", ["farmer_id"]),
        ("land", ["farmer_id", "farm_id"]),
        ("crop", ["farmer_id", "land_id", "crop_catalog_id"]),
        ("activity", ["farmer_id", "crop_id", "land_id", "activity_type_id"]),
        ("activity_expense", ["activity_id", "expense_category_id"]),
        ("activity_attachment", ["activity_id"]),
        ("land_point", ["land_id"]),
        ("farm_crop", ["farm_id", "crop_catalog_id"]),
        ("weather_cache", []),
    ]

    for table_name, fk_columns in tables_to_convert:
        # Convert FK columns to bigint first
        for fk_col in fk_columns:
            if fk_col.endswith("_id"):
                op.alter_column(table_name, fk_col, existing_type=sa.UUID(), type_=sa.BigInteger())

    # Manually handle special FKs with different logic
    # activity.parent_activity_id is self-referential
    op.alter_column("activity", "parent_activity_id", existing_type=sa.UUID(), type_=sa.BigInteger(), nullable=True)

    # Now convert primary keys from UUID to bigint for all tables
    for table_name, _ in tables_to_convert:
        op.drop_constraint(f"{table_name}_pkey", table_name, type_="primary")
        op.drop_column(table_name, "id")
        op.add_column(table_name, sa.Column("id", sa.BigInteger(), nullable=False, autoincrement=True))
        op.create_primary_key(f"{table_name}_pkey", table_name, ["id"])

    # Seed reference data
    seasons = ["Kharif", "Rabi", "Zaid"]
    for season_name in seasons:
        op.execute(f"INSERT INTO season (name) VALUES ('{season_name}')")

    crop_stages = [
        "Land Preparation", "Sowing", "Germination", "Vegetative Growth",
        "Flowering", "Fruiting / Pod Formation", "Maturity", "Harvest",
    ]
    for stage_name in crop_stages:
        op.execute(f"INSERT INTO crop_stage (name) VALUES ('{stage_name}')")

    activity_types = [
        "Sowing", "Irrigation", "Fertilizer Application", "Spray Application",
        "Weeding", "Field Inspection", "Labour Activity", "Harvest", "Sale",
        "Weather Incident", "Maintenance", "Custom",
    ]
    for activity_type in activity_types:
        op.execute(f"INSERT INTO activity_type (name) VALUES ('{activity_type}')")

    expense_categories = [
        "Machine Rent", "Labour", "Seeds", "Fertilizer", "Pesticide",
        "Transport", "Fuel", "Equipment", "Water", "Other",
    ]
    for category in expense_categories:
        op.execute(f"INSERT INTO expense_category (name) VALUES ('{category}')")


def downgrade() -> None:
    # Downgrade is complex; revert to UUID for all tables
    # This is a major schema change, so downgrade is omitted
    pass
