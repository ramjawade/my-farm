"""Watchlists: named lists of crop-at-market items, with the latest price of each item."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from myfarm_api.core.db import get_session_factory
from myfarm_api.core.price_lookup import latest_snapshots
from myfarm_api.models import CropCatalog, Farmer, Mandi, Watchlist, WatchlistItem
from myfarm_api.routers.mandis import get_current_farmer
from myfarm_api.schemas.common import DbId
from myfarm_api.schemas.mandi import MandiRead
from myfarm_api.schemas.watchlist import (
    WatchlistCreate,
    WatchlistItemCreate,
    WatchlistItemRead,
    WatchlistRead,
    Watchlists,
)

router = APIRouter(prefix="/api/v1/watchlists", tags=["watchlists"])

MAX_LISTS = 10
MAX_ITEMS_PER_LIST = 20
RESERVED_NAME = "my farm"


async def _owned_list(session: AsyncSession, farmer: Farmer, list_id: int) -> Watchlist:
    """The farmer's list, or 404. Items have no farmer column; tenancy flows through this."""
    stmt = select(Watchlist).where(Watchlist.id == list_id, Watchlist.farmer_id == farmer.id)
    found = (await session.execute(stmt)).scalar_one_or_none()
    if found is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return found


async def _load_lists(
    session: AsyncSession, farmer_id: int, list_id: int | None = None
) -> list[Watchlist]:
    """The farmer's lists, oldest first, with items loaded (async sessions cannot lazy-load)."""
    stmt = (
        select(Watchlist)
        .options(selectinload(Watchlist.items))
        .where(Watchlist.farmer_id == farmer_id)
        .order_by(Watchlist.created_at, Watchlist.id)
    )
    if list_id is not None:
        stmt = stmt.where(Watchlist.id == list_id)
    return list((await session.execute(stmt)).scalars().all())


async def _read_lists(session: AsyncSession, lists: list[Watchlist]) -> list[WatchlistRead]:
    """The lists with each item's market, crop commodity and latest price."""
    item_ids = [i.id for wl in lists for i in wl.items]
    rows: dict[int, tuple[WatchlistItem, Mandi, str | None]] = {}
    if item_ids:
        stmt = (
            select(WatchlistItem, Mandi, CropCatalog.price_commodity)
            .join(Mandi, Mandi.id == WatchlistItem.mandi_id)
            .join(CropCatalog, CropCatalog.id == WatchlistItem.crop_catalog_id)
            .where(WatchlistItem.id.in_(item_ids))
        )
        for item, mandi, commodity in (await session.execute(stmt)).all():
            rows[item.id] = (item, mandi, commodity)
    snapshots = await latest_snapshots(
        session, [(mandi.id, commodity or "") for _, mandi, commodity in rows.values()]
    )

    out: list[WatchlistRead] = []
    for wl in lists:
        items: list[WatchlistItemRead] = []
        for stored in wl.items:
            item, mandi, commodity = rows[stored.id]
            snap = snapshots.get((mandi.id, commodity or ""))
            items.append(
                WatchlistItemRead(
                    id=item.id,
                    crop_catalog_id=item.crop_catalog_id,
                    commodity=commodity or "",
                    mandi=MandiRead.model_validate(mandi),
                    price=snap.price if snap else None,
                    price_date=snap.price_date if snap else None,
                    previous_price=snap.previous_price if snap else None,
                    change_pct=snap.change_pct if snap else None,
                )
            )
        out.append(WatchlistRead(id=wl.id, name=wl.name, items=items))
    return out


@router.get("", response_model=Watchlists)
async def list_watchlists(farmer: Farmer = Depends(get_current_farmer)) -> Watchlists:
    """The farmer's lists, oldest first, with their items and latest prices."""
    async with get_session_factory()() as session:
        lists = await _load_lists(session, farmer.id)
        return Watchlists(lists=await _read_lists(session, lists))


@router.post("", response_model=WatchlistRead, status_code=201)
async def create_watchlist(
    data: WatchlistCreate, farmer: Farmer = Depends(get_current_farmer)
) -> WatchlistRead:
    """Create an empty list. 409 for a repeated or reserved name, or at the list limit."""
    if data.name.lower() == RESERVED_NAME:
        raise HTTPException(status_code=409, detail="reserved_name")
    async with get_session_factory()() as session:
        count = await session.scalar(
            select(func.count()).select_from(Watchlist).where(Watchlist.farmer_id == farmer.id)
        )
        if (count or 0) >= MAX_LISTS:
            raise HTTPException(status_code=409, detail="list_limit")
        taken = await session.scalar(
            select(Watchlist.id).where(
                Watchlist.farmer_id == farmer.id, func.lower(Watchlist.name) == data.name.lower()
            )
        )
        if taken is not None:
            raise HTTPException(status_code=409, detail="name_taken")
        wl = Watchlist(farmer_id=farmer.id, name=data.name)
        session.add(wl)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            raise HTTPException(status_code=409, detail="name_taken") from None
        await session.refresh(wl)
        return WatchlistRead(id=wl.id, name=wl.name, items=[])


@router.delete("/{list_id}", status_code=204)
async def delete_watchlist(list_id: DbId, farmer: Farmer = Depends(get_current_farmer)) -> None:
    """Delete a list and its items."""
    async with get_session_factory()() as session:
        wl = await _owned_list(session, farmer, list_id)
        await session.delete(wl)
        await session.commit()


@router.post("/{list_id}/items", response_model=WatchlistItemRead, status_code=201)
async def add_watchlist_item(
    list_id: DbId, data: WatchlistItemCreate, farmer: Farmer = Depends(get_current_farmer)
) -> WatchlistItemRead:
    """Add a crop at a market. The crop must have a mandi price; no repeats; 20 per list."""
    async with get_session_factory()() as session:
        wl = await _owned_list(session, farmer, list_id)
        crop = await session.get(CropCatalog, data.crop_catalog_id)
        if crop is None:
            raise HTTPException(status_code=404, detail="Crop not found")
        if not crop.price_commodity:
            raise HTTPException(status_code=422, detail="crop_has_no_price")
        if await session.get(Mandi, data.mandi_id) is None:
            raise HTTPException(status_code=404, detail="Mandi not found")

        count = await session.scalar(
            select(func.count())
            .select_from(WatchlistItem)
            .where(WatchlistItem.watchlist_id == wl.id)
        )
        if (count or 0) >= MAX_ITEMS_PER_LIST:
            raise HTTPException(status_code=409, detail="item_limit")
        duplicate = await session.scalar(
            select(WatchlistItem.id).where(
                WatchlistItem.watchlist_id == wl.id,
                WatchlistItem.crop_catalog_id == data.crop_catalog_id,
                WatchlistItem.mandi_id == data.mandi_id,
            )
        )
        if duplicate is not None:
            raise HTTPException(status_code=409, detail="duplicate_item")

        item = WatchlistItem(
            watchlist_id=wl.id, crop_catalog_id=data.crop_catalog_id, mandi_id=data.mandi_id
        )
        session.add(item)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            raise HTTPException(status_code=409, detail="duplicate_item") from None
        fresh = await _load_lists(session, farmer.id, list_id)
        read = (await _read_lists(session, fresh))[0]
        return next(i for i in read.items if i.id == item.id)


@router.delete("/{list_id}/items/{item_id}", status_code=204)
async def remove_watchlist_item(
    list_id: DbId, item_id: DbId, farmer: Farmer = Depends(get_current_farmer)
) -> None:
    """Remove one item from a list."""
    async with get_session_factory()() as session:
        wl = await _owned_list(session, farmer, list_id)
        item = (
            await session.execute(
                select(WatchlistItem).where(
                    WatchlistItem.id == item_id, WatchlistItem.watchlist_id == wl.id
                )
            )
        ).scalar_one_or_none()
        if item is None:
            raise HTTPException(status_code=404, detail="Item not found")
        await session.delete(item)
        await session.commit()
