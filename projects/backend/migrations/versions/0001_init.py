"""Initialize schema: farmer, farm, land, crop, activity, weather.

Revision ID: 0001_init
Revises:
Create Date: 2026-09-08 08:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_init"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Reference tables (no farmer_id)
    op.create_table(
        "crop_catalog",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("common_names", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "expense_category",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "activity_type",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "weather_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("grid_lat", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("grid_lng", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("place_name", sa.String(255), nullable=True),
        sa.Column(
            "current", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "forecast", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column("alerts", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("grid_lat", "grid_lng", name="uq_grid_location"),
    )
    op.create_index("idx_grid_location", "weather_cache", ["grid_lat", "grid_lng"])

    # Tenant root
    op.create_table(
        "farmer",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("auth_uid", sa.String(128), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("preferred_language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("user_role", sa.String(255), nullable=False, server_default="farmer"),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("auth_uid"),
        sa.UniqueConstraint("phone"),
    )

    # Farmer-owned entities
    op.create_table(
        "farm",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("area", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("area_unit", sa.String(50), nullable=False, server_default="sq_m"),
        sa.Column("water_source", sa.String(255), nullable=True),
        sa.Column("irrigation_type", sa.String(255), nullable=True),
        sa.Column("farming_method", sa.String(255), nullable=True),
        sa.Column("location_type", sa.String(255), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("district", sa.String(100), nullable=True),
        sa.Column("village", sa.String(255), nullable=True),
        sa.Column("pincode", sa.String(10), nullable=True),
        sa.Column("lat", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("lng", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("setup_completed", sa.Boolean(), nullable=False, server_default="false"),
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
        sa.ForeignKeyConstraint(["farmer_id"], ["farmer.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "farm_crop",
        sa.Column("farm_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("crop_catalog_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["crop_catalog_id"], ["crop_catalog.id"]),
        sa.ForeignKeyConstraint(["farm_id"], ["farm.id"]),
        sa.PrimaryKeyConstraint("crop_catalog_id", "farm_id"),
        sa.UniqueConstraint(
            "farm_id", "crop_catalog_id", name="uq_farm_crop_catalog"
        ),
    )

    op.create_table(
        "land",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("farm_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("area_sq_m", sa.Numeric(precision=12, scale=2), nullable=True),
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
        sa.ForeignKeyConstraint(["farm_id"], ["farm.id"]),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmer.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "land_point",
        sa.Column("land_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("lat", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("lng", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.ForeignKeyConstraint(["land_id"], ["land.id"]),
        sa.PrimaryKeyConstraint("land_id", "seq"),
        sa.UniqueConstraint("land_id", "seq", name="uq_land_seq"),
    )
    op.create_index("idx_land_id", "land_point", ["land_id"])

    op.create_table(
        "crop",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("land_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("crop_catalog_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("area", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("area_unit", sa.String(50), nullable=False, server_default="sq_m"),
        sa.Column("season", sa.String(100), nullable=True),
        sa.Column("sowing_date", sa.String(10), nullable=True),
        sa.Column("current_stage", sa.String(100), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("expected_harvest_date", sa.String(10), nullable=True),
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
        sa.ForeignKeyConstraint(["crop_catalog_id"], ["crop_catalog.id"]),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmer.id"]),
        sa.ForeignKeyConstraint(["land_id"], ["land.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "activity",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_activity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("crop_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("land_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("activity_type_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("custom_activity_name", sa.String(255), nullable=True),
        sa.Column("date", sa.String(10), nullable=True),
        sa.Column("season", sa.String(100), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "activity_meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
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
        sa.ForeignKeyConstraint(["activity_type_id"], ["activity_type.id"]),
        sa.ForeignKeyConstraint(["crop_id"], ["crop.id"]),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmer.id"]),
        sa.ForeignKeyConstraint(["land_id"], ["land.id"]),
        sa.ForeignKeyConstraint(["parent_activity_id"], ["activity.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "activity_expense",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("activity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "expense_category_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("item_id", sa.String(255), nullable=True),
        sa.Column("resource_id", sa.String(255), nullable=True),
        sa.Column("quantity", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("unit", sa.String(50), nullable=True),
        sa.Column("rate", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["expense_category_id"], ["expense_category.id"]
        ),
        sa.ForeignKeyConstraint(["activity_id"], ["activity.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "activity_attachment",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("activity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_key", sa.String(1024), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
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
        sa.ForeignKeyConstraint(["activity_id"], ["activity.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("activity_attachment")
    op.drop_table("activity_expense")
    op.drop_table("activity")
    op.drop_table("crop")
    op.drop_index("idx_land_id", table_name="land_point")
    op.drop_table("land_point")
    op.drop_table("land")
    op.drop_table("farm_crop")
    op.drop_table("farm")
    op.drop_table("farmer")
    op.drop_index("idx_grid_location", table_name="weather_cache")
    op.drop_table("weather_cache")
    op.drop_table("activity_type")
    op.drop_table("expense_category")
    op.drop_table("crop_catalog")
