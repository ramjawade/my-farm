import { toSignal } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';

import { Activity } from '../../activity/activity.models';
import { ChatOrchestratorService } from '../chat-orchestrator.service';
import { ChatPanelComponent } from '../chat-panel/chat-panel.component';
import { ReviewPopupComponent } from '../review-popup/review-popup.component';

/**
 * Mounts the chat-bot module globally (#260): a FAB reachable from any
 * authenticated page, opening the chat panel (#257) driven by the
 * orchestrator (#258), with the review popup (#259) as the only path to
 * creation. Only ever instantiated inside `AppLayout`'s authenticated
 * branch, so it never needs its own login check.
 *
 * `ChatOrchestratorService` is provided by `AppLayout`, not `providedIn: 'root'`:
 * the overlay and the `/chat` page share one conversation, and it lives and
 * dies with the signed-in layout instead of being a bare app-wide singleton.
 * The review popup is mounted here on every page, so the page needs none.
 */
@Component({
  selector: 'app-chat-bot-container',
  imports: [ChatPanelComponent, ReviewPopupComponent, TranslatePipe],
  templateUrl: './chat-bot-container.component.html',
  styleUrl: './chat-bot-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatBotContainerComponent {
  private readonly router = inject(Router);

  readonly orchestrator = inject(ChatOrchestratorService);

  readonly open = signal(false);

  /** Where the farmer is now; the floating button is not shown on the assistant page. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  readonly onChatPage = computed(() => this.url().split(/[?#]/)[0] === '/chat');

  readonly reviewEntry = computed(() =>
    this.orchestrator.reviewOpen() ? this.orchestrator.draft() : null,
  );

  constructor() {
    // Arriving on the page (sidebar, expand) leaves nothing floating above it.
    effect(() => {
      if (this.onChatPage()) this.open.set(false);
    });

    // The manual-form escape hatch is a one-way exit: navigate away, then end
    // the entry so a farmer who comes back doesn't resume one the bot already
    // gave up on. The thread stays: it is saved history.
    effect(() => {
      const hatch = this.orchestrator.escapeHatch();
      if (!hatch) return;

      const entry = hatch.entry;
      void this.router.navigate(['/activities/create'], {
        queryParams: {
          type: entry.activity_type || undefined,
          date: entry.date ? entry.date.slice(0, 10) : undefined,
          cropId: entry.crop_id ?? undefined,
          fieldId: entry.land_id ?? undefined,
          notes: entry.notes ?? undefined,
        },
      });
      this.open.set(false);
      this.orchestrator.endEntry();
    });
  }

  openChat(): void {
    this.open.set(true);
    // Restore saved messages and, at most once a day, the brief. Deliberately
    // an explicit call on open rather than an effect: nothing loads until the
    // farmer actually opens the chat.
    void this.orchestrator.onOpen();
  }

  closeChat(): void {
    this.open.set(false);
  }

  /** Open the assistant page; it shows the same conversation. */
  expandChat(): void {
    this.open.set(false);
    void this.router.navigate(['/chat']);
  }

  onReviewRequested(): void {
    this.orchestrator.requestReview();
  }

  onReviewSaved(_activity: Activity): void {
    this.open.set(false);
    this.orchestrator.endEntry();
  }

  onReviewCancelled(): void {
    // Discarded — nothing was ever created. Matches #256's design: Cancel
    // clears local state entirely, same as the manual form was never opened.
    this.orchestrator.endEntry();
  }
}
