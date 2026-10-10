import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * The current page as declared by its route: translation key of the title,
 * nav section, and the back target (`data.parent` with `:param` tokens filled
 * from the route params). Updated on navigation only; it makes no requests.
 */
@Injectable({ providedIn: 'root' })
export class PageMetaService {
  private readonly router = inject(Router);

  readonly titleKey = signal<string | undefined>(undefined);
  readonly section = signal<string | undefined>(undefined);
  readonly parentUrl = signal<string | undefined>(undefined);

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.read());
    this.read();
  }

  private read(): void {
    let route: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;
    let title: string | undefined;
    while (route.firstChild) {
      route = route.firstChild;
      if (typeof route.routeConfig?.title === 'string') {
        title = route.routeConfig.title;
      }
    }
    const data = route.data as { section?: string; parent?: string };
    this.titleKey.set(title);
    this.section.set(data.section);
    this.parentUrl.set(fillParams(data.parent, route.params));
  }
}

export function fillParams(
  path: string | undefined,
  params: Record<string, string>,
): string | undefined {
  return path?.replace(/:(\w+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ''));
}
