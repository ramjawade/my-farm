import { Injectable, computed, signal } from '@angular/core';

/**
 * App-wide network-activity indicator. Reference-counted so overlapping
 * in-flight requests don't hide the loader until every one of them
 * finishes. Render it with `<lib-loader-outlet>`.
 */
@Injectable({ providedIn: 'root' })
export class LoaderService {
  private nextId = 1;
  private readonly activeIds = signal<ReadonlySet<string>>(new Set());
  readonly isLoading = computed(() => this.activeIds().size > 0);

  /** Registers one in-flight operation; pass the returned id to `hide()`. */
  show(): string {
    const id = `loader-${this.nextId++}`;
    this.activeIds.update((ids) => new Set(ids).add(id));
    return id;
  }

  hide(id: string): void {
    this.activeIds.update((ids) => {
      if (!ids.has(id)) return ids;
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }
}
