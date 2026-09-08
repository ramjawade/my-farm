"""Farmer repository — JIT provisioning, PIN registration, and retrieval."""


from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from myfarm_api.core.db import get_session_factory
from myfarm_api.core.security import new_pin_auth_uid
from myfarm_api.models import Farmer


class PhoneAlreadyRegisteredError(Exception):
    """A `farmer` row with this phone number already exists."""


class FarmerRepository:
    """Get-or-create a farmer by Firebase auth_uid, plus PIN-account paths."""

    @staticmethod
    async def get_or_create(auth_uid: str) -> Farmer:
        """Fetch or JIT-provision a farmer by Firebase uid.

        Returns the farmer row; creates if missing.
        """
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = select(Farmer).where(
                Farmer.auth_uid == auth_uid, Farmer.deleted_at.is_(None)
            )
            result = await session.execute(stmt)
            farmer = result.scalar_one_or_none()

            if farmer:
                return farmer

            # JIT provision: create a new farmer row
            farmer = Farmer(auth_uid=auth_uid)
            session.add(farmer)
            await session.commit()
            await session.refresh(farmer)
            return farmer

    @staticmethod
    async def update_by_auth_uid(auth_uid: str, fields: dict[str, object]) -> Farmer | None:
        """Apply a partial profile update to the live farmer for `auth_uid`.

        `fields` is already filtered to the caller-supplied keys (Pydantic
        `exclude_unset`), so an absent key is left untouched. Returns the
        updated row, or None if there is no such farmer.
        """
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = select(Farmer).where(
                Farmer.auth_uid == auth_uid, Farmer.deleted_at.is_(None)
            )
            farmer = (await session.execute(stmt)).scalar_one_or_none()
            if farmer is None:
                return None
            for key, value in fields.items():
                setattr(farmer, key, value)
            await session.commit()
            await session.refresh(farmer)
            return farmer

    @staticmethod
    async def get_by_phone(phone: str) -> Farmer | None:
        """Look up a live farmer by phone number (UNIQUE column)."""
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = select(Farmer).where(
                Farmer.phone == phone, Farmer.deleted_at.is_(None)
            )
            result = await session.execute(stmt)
            return result.scalar_one_or_none()

    @staticmethod
    async def create_pin_farmer(
        *,
        phone: str,
        full_name: str,
        pin_hash: str,
        preferred_language: str = "en",
    ) -> Farmer:
        """Provision a PIN account: a stable `pin:` auth_uid + the PIN hash.

        Raises `PhoneAlreadyRegisteredError` if the phone is taken — the
        UNIQUE constraint is the race-safe check, not a prior SELECT.
        """
        session_factory = get_session_factory()
        async with session_factory() as session:
            farmer = Farmer(
                auth_uid=new_pin_auth_uid(),
                phone=phone,
                full_name=full_name,
                pin_hash=pin_hash,
                preferred_language=preferred_language,
            )
            session.add(farmer)
            try:
                await session.commit()
            except IntegrityError as exc:
                await session.rollback()
                raise PhoneAlreadyRegisteredError(phone) from exc
            await session.refresh(farmer)
            return farmer
