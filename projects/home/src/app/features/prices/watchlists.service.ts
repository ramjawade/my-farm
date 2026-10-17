import { Injectable, inject } from '@angular/core';
import {
  WatchlistItemResponse,
  WatchlistResponse,
  WatchlistsResponse,
} from '../../core/api/contracts';
import { HttpService } from '../../core/http/http.service';

/** Limits the backend enforces; checked here too so the farmer is told before asking. */
export const MAX_LISTS = 10;
export const MAX_LIST_ITEMS = 20;
export const MAX_LIST_NAME = 30;
/** "My farm" is the built-in tab, so a list cannot take its name. */
export const RESERVED_LIST_NAME = 'my farm';

/** The backend's short refusal codes, found in the problem title. */
export type WatchlistRefusal =
  | 'name_taken'
  | 'reserved_name'
  | 'list_limit'
  | 'item_limit'
  | 'duplicate_item'
  | 'crop_has_no_price';

/** The refusal code in an HTTP error, if the backend sent one. */
export function refusalOf(error: unknown): WatchlistRefusal | null {
  const title = (error as { error?: { title?: unknown } } | null)?.error?.title;
  return typeof title === 'string' ? (title as WatchlistRefusal) : null;
}

/** The farmer's watchlists: lists of crop-at-market items, each with its latest price. */
@Injectable({ providedIn: 'root' })
export class WatchlistsService {
  private readonly http = inject(HttpService);

  async list(): Promise<WatchlistResponse[]> {
    const resp = await this.http.get<WatchlistsResponse>('/watchlists');
    return resp.lists;
  }

  create(name: string): Promise<WatchlistResponse> {
    return this.http.post<WatchlistResponse>('/watchlists', { name });
  }

  remove(listId: number): Promise<void> {
    return this.http.delete<void>(`/watchlists/${listId}`);
  }

  addItem(listId: number, cropCatalogId: number, mandiId: number): Promise<WatchlistItemResponse> {
    return this.http.post<WatchlistItemResponse>(`/watchlists/${listId}/items`, {
      crop_catalog_id: cropCatalogId,
      mandi_id: mandiId,
    });
  }

  removeItem(listId: number, itemId: number): Promise<void> {
    return this.http.delete<void>(`/watchlists/${listId}/items/${itemId}`);
  }
}
