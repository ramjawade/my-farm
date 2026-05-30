import { Component, OnDestroy, inject, signal, output } from '@angular/core';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, tap, switchMap, catchError, takeUntil } from 'rxjs/operators';
import { MapSearchService } from './map-search.service';
import { MapSearchResult } from '../../models/map.models';

const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 400;

@Component({
  standalone: true,
  selector: 'app-map-search',
  templateUrl: './map-search.component.html',
  styleUrl: './map-search.component.scss'
})
export class MapSearchComponent implements OnDestroy {
  private readonly geocoding = inject(MapSearchService);
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly resultSelected = output<MapSearchResult>();
  readonly searchCleared = output<void>();

  readonly searchQuery = signal('');
  readonly searchResults = signal<MapSearchResult[]>([]);
  readonly searchLoading = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly showResults = signal(false);

  constructor() {
    this.searchInput$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        tap((query) => {
          const trimmed = query.trim();
          if (trimmed.length === 0) {
            this.searchCleared.emit();
          }
          if (trimmed.length < MIN_SEARCH_LENGTH) {
            this.searchResults.set([]);
            this.searchError.set(null);
            this.showResults.set(false);
            this.searchLoading.set(false);
          }
        }),
        filter((query) => query.trim().length >= MIN_SEARCH_LENGTH),
        tap(() => {
          this.searchLoading.set(true);
          this.searchError.set(null);
          this.showResults.set(true);
        }),
        switchMap((query) =>
          this.geocoding.search(query.trim()).pipe(
            catchError(() => {
              this.searchError.set('Search failed. Try again.');
              return of([] as MapSearchResult[]);
            })
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.searchResults.set(results);
        this.searchLoading.set(false);
        if (results.length === 0) {
          this.searchError.set('No matching locations. Try a more specific address.');
        } else {
          this.searchError.set(null);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.searchError.set(null);
    if (!value.trim()) {
      this.clearSearch();
    } else {
      this.searchInput$.next(value);
    }
  }

  onSearchClear(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value.trim()) {
      this.clearSearch();
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.searchNow();
    }
    if (event.key === 'Escape') {
      this.clearSearch();
    }
  }

  searchNow(): void {
    const query = this.searchQuery().trim();
    if (query.length < MIN_SEARCH_LENGTH) {
      this.searchError.set(`Enter at least ${MIN_SEARCH_LENGTH} characters.`);
      this.showResults.set(true);
      return;
    }

    this.searchLoading.set(true);
    this.searchError.set(null);
    this.showResults.set(true);

    this.geocoding.search(query).subscribe({
      next: (results) => this.applySearchResults(results),
      error: () => {
        this.searchLoading.set(false);
        this.searchResults.set([]);
        this.searchError.set('Search failed. Try again.');
      }
    });
  }

  selectResult(result: MapSearchResult): void {
    this.resultSelected.emit(result);
    this.closeResults();
    this.searchQuery.set(result.label);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchInput$.next('');
    this.searchCleared.emit();
    this.closeResults();
  }

  closeResults(): void {
    this.showResults.set(false);
    this.searchResults.set([]);
    this.searchError.set(null);
  }

  private applySearchResults(results: MapSearchResult[]): void {
    this.searchResults.set(results);
    this.searchLoading.set(false);
    if (results.length === 0) {
      this.searchError.set('No matching locations. Try a more specific address.');
    } else {
      this.searchError.set(null);
    }
  }
}
