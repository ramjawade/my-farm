import { Injectable, computed, signal } from '@angular/core';

/**
 * App-wide network-activity indicator. Reference-counted so overlapping
 * in-flight requests don't hide the loader until every one of them
 * finishes. Render it with `<lib-loader-outlet>`.
 */
/** How long the first load may run before `slow` turns on. */
export const SLOW_START_MS = 3000;

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private nextId = 1;
  private readonly activeIds = signal<ReadonlySet<string>>(new Set());
  readonly isLoading = computed(() => this.activeIds().size > 0);

  private readonly slowSignal = signal(false);
  /**
   * True while the first load of the session has run longer than `SLOW_START_MS`. Once the first
   * load has finished it stays false, so later slow requests never look like a cold start.
   */
  readonly slow = this.slowSignal.asReadonly();
  private firstLoadDone = false;
  private slowTimer?: ReturnType<typeof setTimeout>;

  /** Registers one in-flight operation; pass the returned id to `hide()`. */
  show(): string {
    const id = `loader-${this.nextId++}`;
    this.activeIds.update((ids) => new Set(ids).add(id));
    if (!this.firstLoadDone && this.slowTimer === undefined) {
      this.slowTimer = setTimeout(() => this.slowSignal.set(true), SLOW_START_MS);
    }
    return id;
  }

  hide(id: string): void {
    this.activeIds.update((ids) => {
      if (!ids.has(id)) return ids;
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
    if (!this.firstLoadDone && this.activeIds().size === 0) {
      this.firstLoadDone = true;
      clearTimeout(this.slowTimer);
      this.slowTimer = undefined;
      this.slowSignal.set(false);
    }
  }
}
