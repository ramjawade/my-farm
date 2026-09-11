"""Convert all ids from UUID to BIGINT; add season and crop_stage reference tables.

Existing rows keep their relationships: every table gets a new sequence-backed
bigint id, and every foreign key is remapped through a join on the old UUID
before the old columns are dropped.

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

ID_TABLES = [
    "crop_catalog",
    "expense_category",
    "activity_type",
    "weather_cache",
    "farmer",
    "farm",
    "land",
    "crop",
    "activity",
    "activity_expense",
    "activity_attachment",
]

# (child table, fk column, parent table, nullable)
FOREIGN_KEYS = [
    ("farm", "farmer_id", "farmer", False),
    ("farm_crop", "farm_id", "farm", False),
    ("farm_crop", "crop_catalog_id", "crop_catalog", False),
    ("land", "farmer_id", "farmer", False),
    ("land", "farm_id", "farm", False),
    ("land_point", "land_id", "land", False),
    ("crop", "farmer_id", "farmer", False),
    ("crop", "land_id", "land", False),
    ("crop", "crop_catalog_id", "crop_catalog", False),
    ("activity", "farmer_id", "farmer", False),
    ("activity", "parent_activity_id", "activity", True),
    ("activity", "crop_id", "crop", True),
    ("activity", "land_id", "land", True),
    ("activity", "activity_type_id", "activity_type", False),
    ("activity_expense", "activity_id", "activity", False),
    ("activity_expense", "expense_category_id", "expense_category", False),
    ("activity_attachment", "activity_id", "activity", False),
]

SEASONS = ["Kharif", "Rabi", "Zaid"]

CROP_STAGES = [
    "Land Preparation",
    "Sowing",
    "Germination",
    "Vegetative Growth",
    "Flowering",
    "Fruiting / Pod Formation",
    "Maturity",
    "Harvest",
]

ACTIVITY_TYPES = [
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

EXPENSE_CATEGORIES = [
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


def _seed(table: str, names: list[str]) -> None:
    for name in names:
        op.execute(
            sa.text(
                f"INSERT INTO {table} (name) VALUES (:name) ON CONFLICT (name) DO NOTHING"
            ).bindparams(name=name)
        )


def upgrade() -> None:
    for child, col, _, _ in FOREIGN_KEYS:
        op.drop_constraint(f"{child}_{col}_fkey", child, type_="foreignkey")

    for table in ID_TABLES:
        op.execute(f"CREATE SEQUENCE {table}_id_seq AS bigint")
        op.execute(
            f"ALTER TABLE {table} "
            f"ADD COLUMN new_id bigint NOT NULL DEFAULT nextval('{table}_id_seq')"
        )

    for child, col, parent, _ in FOREIGN_KEYS:
        op.execute(f"ALTER TABLE {child} ADD COLUMN {col}_new bigint")
        op.execute(
            f"UPDATE {child} AS c SET {col}_new = p.new_id "
            f"FROM {parent} AS p WHERE c.{col} = p.id"
        )

    # Dropping a column also drops the PKs, unique constraints and indexes on it
    # (farm_crop and land_point composites included); they're recreated below.
    for child, col, _, nullable in FOREIGN_KEYS:
        op.execute(f"ALTER TABLE {child} DROP COLUMN {col}")
        op.execute(f"ALTER TABLE {child} RENAME COLUMN {col}_new TO {col}")
        if not nullable:
            op.execute(f"ALTER TABLE {child} ALTER COLUMN {col} SET NOT NULL")

    for table in ID_TABLES:
        op.execute(f"ALTER TABLE {table} DROP COLUMN id")
        op.execute(f"ALTER TABLE {table} RENAME COLUMN new_id TO id")
        op.execute(f"ALTER SEQUENCE {table}_id_seq OWNED BY {table}.id")
        op.create_primary_key(f"{table}_pkey", table, ["id"])

    op.create_primary_key("farm_crop_pkey", "farm_crop", ["crop_catalog_id", "farm_id"])
    op.create_unique_constraint(
        "uq_farm_crop_catalog", "farm_crop", ["farm_id", "crop_catalog_id"]
    )
    op.create_primary_key("land_point_pkey", "land_point", ["land_id", "seq"])
    op.create_unique_constraint("uq_land_seq", "land_point", ["land_id", "seq"])
    op.create_index("idx_land_id", "land_point", ["land_id"])

    for child, col, parent, _ in FOREIGN_KEYS:
        op.create_foreign_key(f"{child}_{col}_fkey", child, parent, [col], ["id"])

    op.create_table(
        "season",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.UniqueConstraint("name", name="uq_season_name"),
    )
    op.create_table(
        "crop_stage",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.UniqueConstraint("name", name="uq_crop_stage_name"),
    )

    _seed("season", SEASONS)
    _seed("crop_stage", CROP_STAGES)
    _seed("activity_type", ACTIVITY_TYPES)
    _seed("expense_category", EXPENSE_CATEGORIES)


def downgrade() -> None:
    raise NotImplementedError("UUID -> BIGINT id conversion is irreversible")
