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
    # Create SERIAL sequences for all tables
    sequences = [
        "farmer_id_seq", "farm_id_seq", "land_id_seq", "crop_id_seq",
        "activity_id_seq", "activity_expense_id_seq", "activity_attachment_id_seq",
        "crop_catalog_id_seq", "activity_type_id_seq", "expense_category_id_seq",
        "season_id_seq", "crop_stage_id_seq", "weather_cache_id_seq",
    ]
    for seq in sequences:
        op.execute(f"CREATE SEQUENCE {seq}")

    # Step 1: Drop FK constraints pointing to reference tables
    # This allows us to convert the reference table PKs without CASCADE issues
    op.drop_constraint("crop_crop_catalog_id_fkey", "crop", type_="foreignkey")
    op.drop_constraint("farm_crop_crop_catalog_id_fkey", "farm_crop", type_="foreignkey")
    op.drop_constraint("activity_activity_type_id_fkey", "activity", type_="foreignkey")
    op.drop_constraint("activity_expense_expense_category_id_fkey", "activity_expense", type_="foreignkey")

    # Step 2: Convert reference table PKs (they have no FKs now)
    # These tables' PKs are referenced by FKs in other tables
    reference_tables_with_sequences = [
        ("crop_catalog", "crop_catalog_id_seq"),
        ("activity_type", "activity_type_id_seq"),
        ("expense_category", "expense_category_id_seq"),
        ("weather_cache", "weather_cache_id_seq"),
    ]

    for table_name, seq_name in reference_tables_with_sequences:
        op.drop_constraint(f"{table_name}_pkey", table_name, type_="primary")
        op.drop_column(table_name, "id")
        default_sql = f"nextval('{seq_name}'::regclass)"
        op.add_column(
            table_name,
            sa.Column("id", sa.BigInteger(), nullable=False,
                      server_default=default_sql)
        )
        op.create_primary_key(f"{table_name}_pkey", table_name, ["id"])

    # Step 3: Convert FKs to reference tables (now that their PKs are BIGINT)
    op.execute(
        "ALTER TABLE activity "
        "ALTER COLUMN activity_type_id TYPE bigint USING (activity_type_id::text::bigint)"
    )
    op.execute(
        "ALTER TABLE activity_expense "
        "ALTER COLUMN expense_category_id TYPE bigint USING (expense_category_id::text::bigint)"
    )
    op.execute(
        "ALTER TABLE crop "
        "ALTER COLUMN crop_catalog_id TYPE bigint USING (crop_catalog_id::text::bigint)"
    )
    op.execute(
        "ALTER TABLE farm_crop "
        "ALTER COLUMN crop_catalog_id TYPE bigint USING (crop_catalog_id::text::bigint)"
    )

    # Recreate FK constraints to reference tables
    op.create_foreign_key(
        "crop_crop_catalog_id_fkey", "crop", "crop_catalog",
        ["crop_catalog_id"], ["id"]
    )
    op.create_foreign_key(
        "farm_crop_crop_catalog_id_fkey", "farm_crop", "crop_catalog",
        ["crop_catalog_id"], ["id"]
    )
    op.create_foreign_key(
        "activity_activity_type_id_fkey", "activity", "activity_type",
        ["activity_type_id"], ["id"]
    )
    op.create_foreign_key(
        "activity_expense_expense_category_id_fkey", "activity_expense", "expense_category",
        ["expense_category_id"], ["id"]
    )

    # Step 4: Convert tenant-scoped FKs and main table PKs
    # Start with farmer (has no FKs, everything references it)
    op.drop_constraint("farmer_pkey", "farmer", type_="primary")
    op.drop_column("farmer", "id")
    op.add_column(
        "farmer",
        sa.Column("id", sa.BigInteger(), nullable=False,
                  server_default="nextval('farmer_id_seq'::regclass)")
    )
    op.create_primary_key("farmer_pkey", "farmer", ["id"])

    # Now convert FK columns pointing to farmer
    op.execute(
        "ALTER TABLE farm "
        "ALTER COLUMN farmer_id TYPE bigint USING (farmer_id::text::bigint)"
    )
    op.execute(
        "ALTER TABLE land "
        "ALTER COLUMN farmer_id TYPE bigint USING (farmer_id::text::bigint)"
    )
    op.execute(
        "ALTER TABLE crop "
        "ALTER COLUMN farmer_id TYPE bigint USING (farmer_id::text::bigint)"
    )
    op.execute(
        "ALTER TABLE activity "
        "ALTER COLUMN farmer_id TYPE bigint USING (farmer_id::text::bigint)"
    )

    # Convert farm PK
    op.drop_constraint("farm_pkey", "farm", type_="primary")
    op.drop_column("farm", "id")
    op.add_column(
        "farm",
        sa.Column("id", sa.BigInteger(), nullable=False,
                  server_default="nextval('farm_id_seq'::regclass)")
    )
    op.create_primary_key("farm_pkey", "farm", ["id"])

    # Convert FK columns pointing to farm
    op.execute(
        "ALTER TABLE land "
        "ALTER COLUMN farm_id TYPE bigint USING (farm_id::text::bigint)"
    )

    # Convert land PK
    op.drop_constraint("land_pkey", "land", type_="primary")
    op.drop_column("land", "id")
    op.add_column(
        "land",
        sa.Column("id", sa.BigInteger(), nullable=False,
                  server_default="nextval('land_id_seq'::regclass)")
    )
    op.create_primary_key("land_pkey", "land", ["id"])

    # Convert FK columns pointing to land
    op.execute(
        "ALTER TABLE crop "
        "ALTER COLUMN land_id TYPE bigint USING (land_id::text::bigint)"
    )
    op.execute(
        "ALTER TABLE activity "
        "ALTER COLUMN land_id TYPE bigint USING (land_id::text::bigint)"
    )
    op.execute(
        "ALTER TABLE land_point "
        "ALTER COLUMN land_id TYPE bigint USING (land_id::text::bigint)"
    )

    # Convert crop PK
    op.drop_constraint("crop_pkey", "crop", type_="primary")
    op.drop_column("crop", "id")
    op.add_column(
        "crop",
        sa.Column("id", sa.BigInteger(), nullable=False,
                  server_default="nextval('crop_id_seq'::regclass)")
    )
    op.create_primary_key("crop_pkey", "crop", ["id"])

    # Convert FK columns pointing to crop
    op.execute(
        "ALTER TABLE activity "
        "ALTER COLUMN crop_id TYPE bigint USING (crop_id::text::bigint)"
    )

    # Convert activity PK
    op.drop_constraint("activity_pkey", "activity", type_="primary")
    op.drop_column("activity", "id")
    op.add_column(
        "activity",
        sa.Column("id", sa.BigInteger(), nullable=False,
                  server_default="nextval('activity_id_seq'::regclass)")
    )
    op.create_primary_key("activity_pkey", "activity", ["id"])

    # Convert FK columns pointing to activity
    op.execute(
        "ALTER TABLE activity "
        "ALTER COLUMN parent_activity_id TYPE bigint USING (parent_activity_id::text::bigint)"
    )
    op.execute(
        "ALTER TABLE activity_expense "
        "ALTER COLUMN activity_id TYPE bigint USING (activity_id::text::bigint)"
    )
    op.execute(
        "ALTER TABLE activity_attachment "
        "ALTER COLUMN activity_id TYPE bigint USING (activity_id::text::bigint)"
    )

    # Convert activity_expense and activity_attachment PKs
    op.drop_constraint("activity_expense_pkey", "activity_expense", type_="primary")
    op.drop_column("activity_expense", "id")
    op.add_column(
        "activity_expense",
        sa.Column("id", sa.BigInteger(), nullable=False,
                  server_default="nextval('activity_expense_id_seq'::regclass)")
    )
    op.create_primary_key("activity_expense_pkey", "activity_expense", ["id"])

    op.drop_constraint("activity_attachment_pkey", "activity_attachment", type_="primary")
    op.drop_column("activity_attachment", "id")
    op.add_column(
        "activity_attachment",
        sa.Column("id", sa.BigInteger(), nullable=False,
                  server_default="nextval('activity_attachment_id_seq'::regclass)")
    )
    op.create_primary_key("activity_attachment_pkey", "activity_attachment", ["id"])

    # Create new reference tables with bigint ids
    op.create_table(
        "season",
        sa.Column(
            "id", sa.BigInteger(), nullable=False,
            server_default="nextval('season_id_seq'::regclass)"
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_season_name"),
    )

    op.create_table(
        "crop_stage",
        sa.Column(
            "id", sa.BigInteger(), nullable=False,
            server_default="nextval('crop_stage_id_seq'::regclass)"
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_crop_stage_name"),
    )

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
        op.execute(
            f"INSERT INTO activity_type (name) VALUES ('{activity_type}')"
        )

    expense_categories = [
        "Machine Rent", "Labour", "Seeds", "Fertilizer", "Pesticide",
        "Transport", "Fuel", "Equipment", "Water", "Other",
    ]
    for category in expense_categories:
        op.execute(
            f"INSERT INTO expense_category (name) VALUES ('{category}')"
        )


def downgrade() -> None:
    # Downgrade is complex; revert to UUID for all tables
    pass
