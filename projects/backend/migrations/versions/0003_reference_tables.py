"""Add reference tables: season and crop_stage; convert reference tables to numeric IDs.

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
    # Create season table
    op.create_table(
        "season",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_season_name"),
    )

    # Create crop_stage table
    op.create_table(
        "crop_stage",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_crop_stage_name"),
    )

    # Alter activity_type table: drop old UUID id, add new serial id
    op.drop_constraint("activity_type_pkey", "activity_type", type_="primary")
    op.drop_column("activity_type", "id")
    op.add_column(
        "activity_type",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True, server_default="nextval('activity_type_id_seq'::regclass)")
    )
    op.create_primary_key("activity_type_pkey", "activity_type", ["id"])

    # Alter expense_category table: drop old UUID id, add new serial id
    op.drop_constraint("expense_category_pkey", "expense_category", type_="primary")
    op.drop_column("expense_category", "id")
    op.add_column(
        "expense_category",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True, server_default="nextval('expense_category_id_seq'::regclass)")
    )
    op.create_primary_key("expense_category_pkey", "expense_category", ["id"])

    # Seed seasons
    seasons = ["Kharif", "Rabi", "Zaid"]
    for season_name in seasons:
        op.execute(
            f"INSERT INTO season (name) VALUES ('{season_name}')"
        )

    # Seed crop stages
    crop_stages = [
        "Land Preparation",
        "Sowing",
        "Germination",
        "Vegetative Growth",
        "Flowering",
        "Fruiting / Pod Formation",
        "Maturity",
        "Harvest",
    ]
    for stage_name in crop_stages:
        op.execute(
            f"INSERT INTO crop_stage (name) VALUES ('{stage_name}')"
        )

    # Seed activity types
    activity_types = [
        "Sowing",
        "Irrigation",
        "Fertilizer Application",
        "Spray Application",
        "Weeding",
        "Field Inspection",
        "Labour Activity",
        "Harvest",
        "Sale",
        "Weather Incident",
        "Maintenance",
        "Custom",
    ]
    for activity_type in activity_types:
        op.execute(
            f"INSERT INTO activity_type (name) VALUES ('{activity_type}')"
        )

    # Seed expense categories
    expense_categories = [
        "Machine Rent",
        "Labour",
        "Seeds",
        "Fertilizer",
        "Pesticide",
        "Transport",
        "Fuel",
        "Equipment",
        "Water",
        "Other",
    ]
    for category in expense_categories:
        op.execute(
            f"INSERT INTO expense_category (name) VALUES ('{category}')"
        )


def downgrade() -> None:
    # Downgrade reference tables to UUID
    op.drop_constraint("activity_type_pkey", "activity_type", type_="primary")
    op.drop_column("activity_type", "id")
    op.add_column(
        "activity_type",
        sa.Column("id", sa.UUID(), nullable=False, server_default="gen_random_uuid()")
    )
    op.create_primary_key("activity_type_pkey", "activity_type", ["id"])

    op.drop_constraint("expense_category_pkey", "expense_category", type_="primary")
    op.drop_column("expense_category", "id")
    op.add_column(
        "expense_category",
        sa.Column("id", sa.UUID(), nullable=False, server_default="gen_random_uuid()")
    )
    op.create_primary_key("expense_category_pkey", "expense_category", ["id"])

    # Drop new tables
    op.drop_table("crop_stage")
    op.drop_table("season")
