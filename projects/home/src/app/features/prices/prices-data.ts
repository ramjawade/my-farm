import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import {
  CropMarketResponse,
  MandiPriceResponse,
  MandiResponse,
  PriceHistoryResponse,
  ReferenceItem,
  WatchlistResponse,
} from '../../core/api/contracts';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { HistoryDays, PricesService } from './prices.service';
import { CropTypeRow, groupByCropType } from './prices.utils';
import { WatchlistsService } from './watchlists.service';

/** The crops a farmer grows, with their prices at the followed markets. */
interface FarmPrices {
  rows: CropTypeRow[];
  mine: MandiResponse[];
  suggested: boolean;
}

async function loadFarmPrices(prices: PricesService): Promise<FarmPrices> {
  const [latest, mine] = await Promise.all([prices.latest(), prices.myMandis()]);
  return { rows: groupByCropType(latest.crops), mine: mine.items, suggested: mine.suggested };
}

export type PricesPageData =
  ({ status: 'ok'; lists: WatchlistResponse[] } & FarmPrices) | { status: 'error' };

/** Loads what the Prices page shows. Never throws: a failure becomes `{ status: 'error' }`. */
export async function loadPricesPage(
  prices: PricesService,
  watchlists: WatchlistsService,
): Promise<PricesPageData> {
  try {
    const [farm, lists] = await Promise.all([loadFarmPrices(prices), watchlists.list()]);
    return { status: 'ok', lists, ...farm };
  } catch {
    return { status: 'error' };
  }
}

/**
 * A farmer with crops but no mandi to show (no saved district and none chosen) is sent to
 * My APMCs with a message, instead of a page of empty rows.
 */
export const pricesResolver: ResolveFn<PricesPageData | RedirectCommand> = async () => {
  const prices = inject(PricesService);
  const watchlists = inject(WatchlistsService);
  const router = inject(Router);
  await inject(ReferenceDataService)
    .ready()
    .catch(() => undefined);
  const data = await loadPricesPage(prices, watchlists);
  if (data.status === 'ok' && data.rows.length > 0 && data.mine.length === 0) {
    return new RedirectCommand(
      router.createUrlTree(['/prices/mandis'], { queryParams: { pick: '1' } }),
    );
  }
  return data;
};

export type PriceDetailData =
  | {
      status: 'ok';
      /** The crop type being shown; any crop with a price, not only ones the farmer grows. */
      row: { catalogId: number; commodity: string };
      /** Markets that have a price for the crop, best first (the opened one is always in). */
      priced: MandiPriceResponse[];
      mandiId: number;
      days: HistoryDays;
      /** The last 30 days, always loaded: the average badge compares with it. */
      history30: PriceHistoryResponse;
      /** The selected period (the same object as `history30` when the period is 30 days). */
      history: PriceHistoryResponse;
    }
  | { status: 'notFound' }
  | { status: 'error' };

export function parsePeriod(text: string | null): HistoryDays {
  return text === '7' ? 7 : text === '365' ? 365 : 30;
}

/** A market from the markets endpoint, in the shape the detail page already works with. */
export function marketToEntry(market: CropMarketResponse): MandiPriceResponse {
  return {
    mandi: market.mandi,
    price: market.price,
    price_date: market.price_date,
    previous_price: market.previous_price,
    change_pct: market.change_pct,
  };
}

/** How many markets the detail page offers to switch to and to compare. */
export const DETAIL_MARKET_LIMIT = 20;

/**
 * Loads one crop type's price detail: the markets that price it, the chosen market's history
 * and its 30-day figures. Works for any crop with a price, whether or not the farmer grows it.
 */
export async function loadPriceDetail(
  prices: PricesService,
  catalogId: number,
  requestedMandi: number,
  days: HistoryDays,
): Promise<PriceDetailData> {
  try {
    const markets = await prices.cropMarkets(catalogId, {
      limit: DETAIL_MARKET_LIMIT,
      include: requestedMandi > 0 ? requestedMandi : undefined,
    });
    const priced = markets.markets.map(marketToEntry);
    if (priced.length === 0) return { status: 'notFound' };

    const mandiId = priced.some((m) => m.mandi.id === requestedMandi)
      ? requestedMandi
      : priced[0].mandi.id;
    const history30 = await prices.history(mandiId, markets.commodity, 30);
    const history =
      days === 30 ? history30 : await prices.history(mandiId, markets.commodity, days);
    return {
      status: 'ok',
      row: { catalogId, commodity: markets.commodity },
      priced,
      mandiId,
      days,
      history30,
      history,
    };
  } catch (error) {
    return error instanceof HttpErrorResponse && error.status === 404
      ? { status: 'notFound' }
      : { status: 'error' };
  }
}

export const priceDetailResolver: ResolveFn<PriceDetailData> = async (route) => {
  const prices = inject(PricesService);
  await inject(ReferenceDataService)
    .ready()
    .catch(() => undefined);
  return loadPriceDetail(
    prices,
    Number(route.paramMap.get('crop')),
    Number(route.queryParamMap.get('mandi')),
    parsePeriod(route.queryParamMap.get('period')),
  );
};

export type MyApmcsData =
  | {
      status: 'ok';
      mine: MandiResponse[];
      suggested: boolean;
      districts: string[];
      /** Feed commodity names of the farmer's crops, for the "trades my crops" switch. */
      commodities: string[];
    }
  | { status: 'error' };

export async function loadMyApmcs(prices: PricesService): Promise<MyApmcsData> {
  try {
    const [farm, districts] = await Promise.all([loadFarmPrices(prices), prices.districts()]);
    const commodities = [
      ...new Set(farm.rows.map((r) => r.commodity).filter((c): c is string => c !== null)),
    ];
    return { status: 'ok', mine: farm.mine, suggested: farm.suggested, districts, commodities };
  } catch {
    return { status: 'error' };
  }
}

export const myApmcsResolver: ResolveFn<MyApmcsData> = () => loadMyApmcs(inject(PricesService));

export type NewListData =
  | {
      status: 'ok';
      /** The farmer's list names, to refuse a repeat before asking the server. */
      names: string[];
    }
  | { status: 'error' };

export async function loadNewList(watchlists: WatchlistsService): Promise<NewListData> {
  try {
    const lists = await watchlists.list();
    return { status: 'ok', names: lists.map((l) => l.name) };
  } catch {
    return { status: 'error' };
  }
}

export const newListResolver: ResolveFn<NewListData> = () => loadNewList(inject(WatchlistsService));

export type AddItemData =
  | {
      status: 'ok';
      list: { id: number; name: string; count: number };
      /** `cropId:mandiId` of items already in the list, to refuse a repeat. */
      existing: string[];
      /** Crops that have a mandi price, whether or not the farmer grows them. */
      crops: ReferenceItem[];
    }
  | { status: 'notFound' }
  | { status: 'error' };

export async function loadAddItem(
  watchlists: WatchlistsService,
  references: ReferenceDataService,
  listId: number,
): Promise<AddItemData> {
  try {
    const [lists, crops] = await Promise.all([watchlists.list(), references.listCrops()]);
    const list = lists.find((l) => l.id === listId);
    if (!list) return { status: 'notFound' };
    return {
      status: 'ok',
      list: { id: list.id, name: list.name, count: list.items.length },
      existing: list.items.map((i) => `${i.crop_catalog_id}:${i.mandi.id}`),
      crops: crops.filter((c) => c.has_price),
    };
  } catch {
    return { status: 'error' };
  }
}

export const addItemResolver: ResolveFn<AddItemData> = (route) =>
  loadAddItem(
    inject(WatchlistsService),
    inject(ReferenceDataService),
    Number(route.paramMap.get('id')),
  );
