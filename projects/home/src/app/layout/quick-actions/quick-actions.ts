import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  viewChild,
  ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map } from 'rxjs';

import { ChatOrchestratorService } from '../../features/chat-bot/chat-orchestrator.service';
import { ChatOverlayService } from '../../features/chat-bot/chat-overlay.service';
import { FarmDrawService } from '../../map/farm-draw/farm-draw.service';

type ActionId = 'activity' | 'expense' | 'crop' | 'land' | 'assistant';

interface QuickAction {
  readonly id: ActionId;
  readonly labelKey: string;
  readonly icon: string;
}

const ACTIONS: Record<ActionId, QuickAction> = {
  activity: { id: 'activity', labelKey: 'quickActions.activity', icon: 'bi-card-list' },
  expense: { id: 'expense', labelKey: 'quickActions.expense', icon: 'bi-currency-rupee' },
  crop: { id: 'crop', labelKey: 'quickActions.crop', icon: 'bi-flower1' },
  land: { id: 'land', labelKey: 'quickActions.land', icon: 'bi-map' },
  assistant: { id: 'assistant', labelKey: 'quickActions.assistant', icon: 'bi-chat-dots-fill' },
};

const LOG: readonly ActionId[] = ['activity', 'expense', 'assistant'];

/** The top-level screens that carry the button, and what it offers on each. */
const SCREENS: Readonly<Record<string, readonly ActionId[]>> = {
  '/': ['activity', 'expense', 'crop', 'land', 'assistant'],
  '/map': ['land', 'crop', 'assistant'],
  '/crops': ['crop', 'activity', 'assistant'],
  '/activities/list': LOG,
  '/reports': ['assistant'],
  '/prices': ['assistant'],
  '/weather': ['assistant'],
};

/**
 * Phone only (under 992 px): the one round button that replaces the separate floating assistant,
 * add and back buttons. With several actions it opens a labelled menu; with one it does it.
 */
@Component({
  selector: 'app-quick-actions',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-lg-none', '(document:keydown.escape)': 'close()' },
  template: `
    @if (actions().length === 1) {
      <div class="quick-dial">
        <button
          type="button"
          class="quick-fab"
          data-testid="quick-single"
          [attr.aria-label]="actions()[0].labelKey | translate"
          (click)="run(actions()[0])"
        >
          <i class="bi" [class]="actions()[0].icon" aria-hidden="true"></i>
        </button>
      </div>
    } @else if (actions().length > 1) {
      @if (open()) {
        <button
          type="button"
          class="quick-scrim"
          data-testid="quick-scrim"
          [attr.aria-label]="'quickActions.close' | translate"
          (click)="close()"
        ></button>
      }
      <div class="quick-dial">
        @if (open()) {
          <div class="quick-menu" role="menu">
            @for (action of actions(); track action.id) {
              <div class="quick-item">
                <span class="quick-label">{{ action.labelKey | translate }}</span>
                <button
                  type="button"
                  role="menuitem"
                  class="quick-fab quick-fab--mini"
                  [attr.data-testid]="'quick-' + action.id"
                  [attr.aria-label]="action.labelKey | translate"
                  (click)="run(action)"
                >
                  <i class="bi" [class]="action.icon" aria-hidden="true"></i>
                </button>
              </div>
            }
          </div>
        }
        <button
          #toggle
          type="button"
          class="quick-fab"
          data-testid="quick-toggle"
          aria-haspopup="menu"
          [attr.aria-expanded]="open()"
          [attr.aria-label]="(open() ? 'quickActions.close' : 'quickActions.open') | translate"
          (click)="toggleMenu()"
        >
          <i class="bi" [class]="open() ? 'bi-x-lg' : 'bi-plus-lg'" aria-hidden="true"></i>
        </button>
      </div>
    }
  `,
})
export class QuickActions {
  private readonly router = inject(Router);
  private readonly farmDraw = inject(FarmDrawService);
  private readonly overlay = inject(ChatOverlayService);
  private readonly orchestrator = inject(ChatOrchestratorService);

  private readonly toggle = viewChild<ElementRef<HTMLButtonElement>>('toggle');

  private readonly path = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );

  /** Nothing while a land is being drawn, and nothing off the top-level screens. */
  protected readonly actions = computed<readonly QuickAction[]>(() =>
    this.farmDraw.isDrawing() ? [] : (SCREENS[this.path()] ?? []).map((id) => ACTIONS[id]),
  );

  /** The menu folds shut whenever the screen changes. */
  protected readonly open = linkedSignal<string, boolean>({
    source: this.path,
    computation: () => false,
  });

  protected toggleMenu(): void {
    this.open.update((open) => !open);
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.toggle()?.nativeElement.focus();
  }

  protected async run(action: QuickAction): Promise<void> {
    this.open.set(false);
    switch (action.id) {
      case 'activity':
        await this.router.navigate(['/activities/create']);
        break;
      case 'expense':
        await this.router.navigate(['/activities/expenses/new']);
        break;
      case 'crop':
        await this.router.navigate(['/crops/add']);
        break;
      case 'land':
        if (this.path() !== '/map') await this.router.navigateByUrl('/map');
        this.farmDraw.startDrawing();
        break;
      case 'assistant':
        this.overlay.open.set(true);
        void this.orchestrator.onOpen();
        break;
    }
  }
}
