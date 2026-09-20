import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
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
 * `ChatOrchestratorService` is provided here, at the container's level, not
 * `providedIn: 'root'` — its conversation state should live and die with
 * this container (which itself lives for the whole authenticated session,
 * same as the toolbar/sidebar), not be a bare app-wide singleton created by
 * whichever consumer asks for it first.
 */
@Component({
  selector: 'app-chat-bot-container',
  imports: [ChatPanelComponent, ReviewPopupComponent, TranslatePipe],
  providers: [ChatOrchestratorService],
  templateUrl: './chat-bot-container.component.html',
  styleUrl: './chat-bot-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatBotContainerComponent {
  private readonly router = inject(Router);

  readonly orchestrator = inject(ChatOrchestratorService);

  readonly open = signal(false);
  private readonly reviewOpen = signal(false);

  readonly reviewEntry = computed(() => (this.reviewOpen() ? this.orchestrator.draft() : null));

  constructor() {
    // The manual-form escape hatch is a one-way exit: navigate away, then
    // reset so a farmer who comes back starts a fresh conversation instead
    // of resuming a chat the bot already gave up on.
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
      this.reviewOpen.set(false);
      this.orchestrator.reset();
    });
  }

  openChat(): void {
    this.open.set(true);
  }

  closeChat(): void {
    this.open.set(false);
  }

  onReviewRequested(): void {
    this.reviewOpen.set(true);
  }

  onReviewSaved(_activity: Activity): void {
    this.reviewOpen.set(false);
    this.open.set(false);
    this.orchestrator.reset();
  }

  onReviewCancelled(): void {
    // Discarded — nothing was ever created. Matches #256's design: Cancel
    // clears local state entirely, same as the manual form was never opened.
    this.reviewOpen.set(false);
    this.orchestrator.reset();
  }
}
