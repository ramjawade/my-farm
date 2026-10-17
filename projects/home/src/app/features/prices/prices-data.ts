import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import { MandiResponse, PriceHistoryResponse } from '../../core/api/contracts';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { HistoryDays, PricesService } from './prices.service';
import { CropTypeRow, groupByCropType, hasPrice, rankMandis } from './prices.utils';

export type PricesPageData =
  | { status: 'ok'; rows: CropTypeRow[]; mine: MandiResponse[]; suggested: boolean }
  | { status: 'error' };

/** Loads what the Prices page shows. Never throws: a failure becomes `{ status: 'error' }`. */
export async function loadPricesPage(prices: PricesService): Promise<PricesPageData> {
  try {
    const [latest, mine] = await Promise.all([prices.latest(), prices.myMandis()]);
    return {
      status: 'ok',
      rows: groupByCropType(latest.crops),
      mine: mine.items,
      suggested: mine.suggested,
    };
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
  const router = inject(Router);
  await inject(ReferenceDataService)
    .ready()
    .catch(() => undefined);
  const data = await loadPricesPage(prices);
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
      row: CropTypeRow;
      /** Mandis that have a price for the crop, best first. */
      priced: ReturnType<typeof rankMandis>;
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

/** Loads one crop type's price detail: its row, the selected mandi's history and the 30-day figures. */
export async function loadPriceDetail(
  prices: PricesService,
  catalogId: number,
  requestedMandi: number,
  days: HistoryDays,
): Promise<PriceDetailData> {
  const page = await loadPricesPage(prices);
  if (page.status === 'error') return { status: 'error' };

  const row = page.rows.find((r) => r.catalogId === catalogId);
  const priced = row ? rankMandis(row.mandis).filter(hasPrice) : [];
  if (!row || row.commodity === null || priced.length === 0) return { status: 'notFound' };

  const mandiId = priced.some((m) => m.mandi.id === requestedMandi)
    ? requestedMandi
    : priced[0].mandi.id;
  try {
    const history30 = await prices.history(mandiId, row.commodity, 30);
    const history = days === 30 ? history30 : await prices.history(mandiId, row.commodity, days);
    return { status: 'ok', row, priced, mandiId, days, history30, history };
  } catch {
    return { status: 'error' };
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
    const [page, districts] = await Promise.all([loadPricesPage(prices), prices.districts()]);
    if (page.status === 'error') return { status: 'error' };
    const commodities = [
      ...new Set(page.rows.map((r) => r.commodity).filter((c): c is string => c !== null)),
    ];
    return { status: 'ok', mine: page.mine, suggested: page.suggested, districts, commodities };
  } catch {
    return { status: 'error' };
  }
}

export const myApmcsResolver: ResolveFn<MyApmcsData> = () => loadMyApmcs(inject(PricesService));
