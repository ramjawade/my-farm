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

    # Convert all FKs to bigint before converting PKs
    # Reference table FKs
    op.alter_column(
        "activity", "activity_type_id", existing_type=sa.UUID(),
        type_=sa.BigInteger()
    )
    op.alter_column(
        "activity_expense", "expense_category_id",
        existing_type=sa.UUID(), type_=sa.BigInteger()
    )
    op.alter_column(
        "crop", "crop_catalog_id", existing_type=sa.UUID(),
        type_=sa.BigInteger()
    )
    op.alter_column(
        "farm_crop", "crop_catalog_id", existing_type=sa.UUID(),
        type_=sa.BigInteger()
    )

    # Tenant-scoped FKs
    op.alter_column(
        "farm", "farmer_id", existing_type=sa.UUID(), type_=sa.BigInteger()
    )
    op.alter_column(
        "land", "farmer_id", existing_type=sa.UUID(), type_=sa.BigInteger()
    )
    op.alter_column(
        "land", "farm_id", existing_type=sa.UUID(), type_=sa.BigInteger()
    )
    op.alter_column(
        "crop", "farmer_id", existing_type=sa.UUID(), type_=sa.BigInteger()
    )
    op.alter_column(
        "crop", "land_id", existing_type=sa.UUID(), type_=sa.BigInteger()
    )
    op.alter_column(
        "activity", "farmer_id", existing_type=sa.UUID(), type_=sa.BigInteger()
    )
    op.alter_column(
        "activity", "crop_id", existing_type=sa.UUID(), type_=sa.BigInteger()
    )
    op.alter_column(
        "activity", "land_id", existing_type=sa.UUID(), type_=sa.BigInteger()
    )
    op.alter_column(
        "activity", "parent_activity_id",
        existing_type=sa.UUID(), type_=sa.BigInteger(), nullable=True
    )
    op.alter_column(
        "activity_expense", "activity_id",
        existing_type=sa.UUID(), type_=sa.BigInteger()
    )
    op.alter_column(
        "activity_attachment", "activity_id",
        existing_type=sa.UUID(), type_=sa.BigInteger()
    )
    op.alter_column(
        "land_point", "land_id", existing_type=sa.UUID(), type_=sa.BigInteger()
    )

    # Now convert all primary keys to bigint with sequences
    tables_with_sequences = [
        ("farmer", "farmer_id_seq"),
        ("farm", "farm_id_seq"),
        ("land", "land_id_seq"),
        ("crop", "crop_id_seq"),
        ("activity", "activity_id_seq"),
        ("activity_expense", "activity_expense_id_seq"),
        ("activity_attachment", "activity_attachment_id_seq"),
        ("crop_catalog", "crop_catalog_id_seq"),
        ("activity_type", "activity_type_id_seq"),
        ("expense_category", "expense_category_id_seq"),
        ("weather_cache", "weather_cache_id_seq"),
    ]

    for table_name, seq_name in tables_with_sequences:
        op.drop_constraint(f"{table_name}_pkey", table_name, type_="primary")
        op.drop_column(table_name, "id")
        default_sql = f"nextval('{seq_name}'::regclass)"
        op.add_column(
            table_name,
            sa.Column("id", sa.BigInteger(), nullable=False,
                      server_default=default_sql)
        )
        op.create_primary_key(f"{table_name}_pkey", table_name, ["id"])

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
