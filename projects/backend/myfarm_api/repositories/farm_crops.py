"""A farm's primary crops, stored as `farm_crop` rows of crop_catalog ids."""

from sqlalchemy import delete, select

from myfarm_api.core.db import get_session_factory
from myfarm_api.models import CropCatalog, FarmCrop


class UnknownCropError(Exception):
    """A crop_catalog id does not exist."""


async def crop_ids_by_farm(farm_ids: list[int]) -> dict[int, list[int]]:
    """Crop catalog ids per farm, sorted; farms without crops map to []."""
    result: dict[int, list[int]] = {farm_id: [] for farm_id in farm_ids}
    if not farm_ids:
        return result
    async with get_session_factory()() as session:
        rows = await session.execute(
            select(FarmCrop.farm_id, FarmCrop.crop_catalog_id)
            .where(FarmCrop.farm_id.in_(farm_ids))
            .order_by(FarmCrop.crop_catalog_id)
        )
        for farm_id, crop_id in rows:
            result[farm_id].append(crop_id)
    return result


async def replace_farm_crops(farm_id: int, crop_catalog_ids: list[int]) -> list[int]:
    """Make the farm's crops exactly `crop_catalog_ids` (deduped). Raises UnknownCropError."""
    wanted = sorted(set(crop_catalog_ids))
    async with get_session_factory()() as session:
        if wanted:
            known = set(
                (
                    await session.execute(
                        select(CropCatalog.id).where(CropCatalog.id.in_(wanted))
                    )
                ).scalars()
            )
            if known != set(wanted):
                raise UnknownCropError
        await session.execute(delete(FarmCrop).where(FarmCrop.farm_id == farm_id))
        session.add_all(FarmCrop(farm_id=farm_id, crop_catalog_id=c) for c in wanted)
        await session.commit()
    return wanted
