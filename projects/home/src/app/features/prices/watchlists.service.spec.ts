import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpService } from '../../core/http/http.service';
import { WatchlistsService, refusalOf } from './watchlists.service';

describe('WatchlistsService', () => {
  let service: WatchlistsService;
  let http: jasmine.SpyObj<HttpService>;

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpService>('HttpService', ['get', 'post', 'delete']);
    http.get.and.resolveTo({ lists: [{ id: 1, name: 'A', items: [] }] });
    http.post.and.resolveTo({ id: 2 });
    http.delete.and.resolveTo(undefined);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: HttpService, useValue: http }],
    });
    service = TestBed.inject(WatchlistsService);
  });

  it('lists the watchlists', async () => {
    expect(await service.list()).toEqual([{ id: 1, name: 'A', items: [] }] as never);
    expect(http.get).toHaveBeenCalledWith('/watchlists');
  });

  it('creates a list from a name', async () => {
    await service.create('Onion markets');
    expect(http.post).toHaveBeenCalledWith('/watchlists', { name: 'Onion markets' });
  });

  it('deletes a list and removes an item', async () => {
    await service.remove(3);
    await service.removeItem(3, 9);
    expect(http.delete).toHaveBeenCalledWith('/watchlists/3');
    expect(http.delete).toHaveBeenCalledWith('/watchlists/3/items/9');
  });

  it('adds a crop at a market', async () => {
    await service.addItem(3, 5, 12);
    expect(http.post).toHaveBeenCalledWith('/watchlists/3/items', {
      crop_catalog_id: 5,
      mandi_id: 12,
    });
  });
});

describe('refusalOf', () => {
  it("reads the backend's refusal code from the problem title", () => {
    const error = new HttpErrorResponse({ status: 409, error: { title: 'name_taken' } });
    expect(refusalOf(error)).toBe('name_taken');
  });

  it('is null for any other error', () => {
    expect(refusalOf(new HttpErrorResponse({ status: 500 }))).toBeNull();
    expect(refusalOf(new Error('x'))).toBeNull();
    expect(refusalOf(null)).toBeNull();
  });
});
