"""Farmer repository — JIT provisioning and retrieval."""


from sqlalchemy import select

from myfarm_api.core.db import get_session_factory
from myfarm_api.models import Farmer


class FarmerRepository:
    """Get-or-create a farmer by Firebase auth_uid."""

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
