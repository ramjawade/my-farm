"""SQLAlchemy ORM models — source of truth for schema and Alembic."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from myfarm_api.core.db import Base


class TenantScopedBase(Base):
    """Abstract base for farmer-owned tables.

    Declares the columns `TenantScopedCRUD` (repositories/crud.py) relies
    on — `id`, `farmer_id`, `updated_at`, `deleted_at` — as a real mapped
    class so its generic bound gets concrete column types instead of
    `Base`'s empty attribute set.
    """

    __abstract__ = True

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farmer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("farmer.id"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Farmer(Base):
    """A single user account, provisioned JIT on first Firebase Auth token."""

    __tablename__ = "farmer"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    auth_uid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    # Set only for PIN accounts (auth_uid starts "pin:"). PBKDF2-SHA256,
    # `pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>` — see core/security.py.
    # Firebase-token accounts never carry one.
    pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(10), default="en")
    user_role: Mapped[str] = mapped_column(String(255), default="farmer")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    farms: Mapped[list["Farm"]] = relationship(
        "Farm", foreign_keys="Farm.farmer_id", cascade="all, delete-orphan"
    )
    lands: Mapped[list["Land"]] = relationship(
        "Land", foreign_keys="Land.farmer_id", cascade="all, delete-orphan"
    )
    crops: Mapped[list["Crop"]] = relationship(
        "Crop", foreign_keys="Crop.farmer_id", cascade="all, delete-orphan"
    )
    activities: Mapped[list["Activity"]] = relationship(
        "Activity", foreign_keys="Activity.farmer_id", cascade="all, delete-orphan"
    )


class CropCatalog(Base):
    """Reference data: known crop species."""

    __tablename__ = "crop_catalog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    common_names: Mapped[str | None] = mapped_column(Text, nullable=True)

    crops: Mapped[list["Crop"]] = relationship(
        "Crop", foreign_keys="Crop.crop_catalog_id"
    )
    farm_crops: Mapped[list["FarmCrop"]] = relationship(
        "FarmCrop", foreign_keys="FarmCrop.crop_catalog_id"
    )


class Season(Base):
    """Reference data: Indian cropping seasons."""

    __tablename__ = "season"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)


class CropStage(Base):
    """Reference data: crop growth stages."""

    __tablename__ = "crop_stage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)


class ExpenseCategory(Base):
    """Reference data: known expense types."""

    __tablename__ = "expense_category"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    expenses: Mapped[list["ActivityExpense"]] = relationship(
        "ActivityExpense", foreign_keys="ActivityExpense.expense_category_id"
    )


class ActivityType(Base):
    """Reference data: known activity types."""

    __tablename__ = "activity_type"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    activities: Mapped[list["Activity"]] = relationship(
        "Activity", foreign_keys="Activity.activity_type_id"
    )


class Farm(TenantScopedBase):
    """A farm belonging to a farmer."""

    __tablename__ = "farm"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    area: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    area_unit: Mapped[str] = mapped_column(String(50), default="sq_m")
    water_source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    irrigation_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    farming_method: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    village: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    setup_completed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    lands: Mapped[list["Land"]] = relationship(
        "Land", foreign_keys="Land.farm_id", cascade="all, delete-orphan"
    )
    farm_crops: Mapped[list["FarmCrop"]] = relationship(
        "FarmCrop", foreign_keys="FarmCrop.farm_id", cascade="all, delete-orphan"
    )


class FarmCrop(Base):
    """Many-to-many: which crops are grown on which farms."""

    __tablename__ = "farm_crop"
    __table_args__ = (
        UniqueConstraint("farm_id", "crop_catalog_id", name="uq_farm_crop_catalog"),
    )

    farm_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("farm.id"),
        primary_key=True,
        nullable=False,
    )
    crop_catalog_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("crop_catalog.id"),
        primary_key=True,
        nullable=False,
    )


class Land(TenantScopedBase):
    """A plot of land belonging to a farmer."""

    __tablename__ = "land"

    farm_id: Mapped[UUID] = mapped_column(
        SQLUuid(as_uuid=True), ForeignKey("farm.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    area_sq_m: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    points: Mapped[list["LandPoint"]] = relationship(
        "LandPoint",
        foreign_keys="LandPoint.land_id",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="LandPoint.seq.asc()",
    )
    crops: Mapped[list["Crop"]] = relationship(
        "Crop", foreign_keys="Crop.land_id", cascade="all, delete-orphan"
    )


class LandPoint(Base):
    """A GPS coordinate polygon vertex for a land plot."""

    __tablename__ = "land_point"
    __table_args__ = (
        UniqueConstraint("land_id", "seq", name="uq_land_seq"),
        Index("idx_land_id", "land_id"),
    )

    land_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("land.id"),
        primary_key=True,
        nullable=False,
    )
    seq: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)
    lat: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    lng: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)


class Crop(TenantScopedBase):
    """A crop planted on a specific land plot."""

    __tablename__ = "crop"

    land_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("land.id"), nullable=False
    )
    crop_catalog_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("crop_catalog.id"), nullable=False
    )
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    area: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    area_unit: Mapped[str] = mapped_column(String(50), default="sq_m")
    season: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sowing_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    current_stage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active")
    expected_harvest_date: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    activities: Mapped[list["Activity"]] = relationship(
        "Activity", foreign_keys="Activity.crop_id", cascade="all, delete-orphan"
    )


class Activity(TenantScopedBase):
    """A farm activity (irrigation, spraying, harvesting, etc.)."""

    __tablename__ = "activity"

    parent_activity_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("activity.id"), nullable=True
    )
    crop_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("crop.id"), nullable=True
    )
    land_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("land.id"), nullable=True
    )
    activity_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("activity_type.id"), nullable=False
    )
    custom_activity_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    season: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    activity_meta: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    expenses: Mapped[list["ActivityExpense"]] = relationship(
        "ActivityExpense",
        foreign_keys="ActivityExpense.activity_id",
        cascade="all, delete-orphan",
    )
    attachments: Mapped[list["ActivityAttachment"]] = relationship(
        "ActivityAttachment",
        foreign_keys="ActivityAttachment.activity_id",
        cascade="all, delete-orphan",
    )


class ActivityExpense(Base):
    """An expense line item for an activity."""

    __tablename__ = "activity_expense"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    activity_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("activity.id"), nullable=False
    )
    expense_category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("expense_category.id"), nullable=False
    )
    item_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rate: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class ActivityAttachment(Base):
    """An attachment (photo, document) linked to an activity."""

    __tablename__ = "activity_attachment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    activity_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("activity.id"), nullable=False
    )
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class WeatherCache(Base):
    """Server-side weather cache, keyed by grid location, shared across farmers."""

    __tablename__ = "weather_cache"
    __table_args__ = (
        UniqueConstraint("grid_lat", "grid_lng", name="uq_grid_location"),
        Index("idx_grid_location", "grid_lat", "grid_lng"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    grid_lat: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    grid_lng: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    place_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    current: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    forecast: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    alerts: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
