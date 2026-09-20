import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';

import {
  ChatEntryError,
  ChatEntryService,
  ResolvedEntry,
} from '../../../core/api/chat-entry.service';
import { Activity } from '../../activity/activity.models';

/**
 * Type an entry in plain language; it is created immediately, with Undo.
 *
 * Presentation only — the parse/create/undo flow lives in `ChatEntryService`.
 *
 * Auto-create rather than a confirmation step is deliberate: the point of the
 * feature is that the farmer speaks or types and is done. Undo keeps the fast
 * path fast while making a mistake one tap to reverse, which a silent save
 * would not.
 */
@Component({
  selector: 'app-chat-entry',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './chat-entry.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatEntryComponent {
  private readonly fb = inject(FormBuilder);
  private readonly chatEntry = inject(ChatEntryService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  readonly busy = signal(false);
  /** The entry just created, shown as the Undo/Edit card. */
  readonly created = signal<{ activity: Activity; entry: ResolvedEntry } | null>(null);
  /** Set when the farmer should rephrase rather than give up. */
  readonly notUnderstood = signal(false);

  async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) return;

    const text = this.form.getRawValue().text.trim();
    if (!text) return;

    this.busy.set(true);
    this.notUnderstood.set(false);
    this.created.set(null);

    try {
      const { parsed } = await this.chatEntry.parse(text);
      const activity = await this.chatEntry.create(parsed);
      this.created.set({ activity, entry: parsed });
      this.form.reset();
    } catch (err) {
      this.handleFailure(err);
    } finally {
      this.busy.set(false);
    }
  }

  async undo(): Promise<void> {
    const current = this.created();
    if (!current) return;
    this.chatEntry.undo(current.activity.id);
    this.created.set(null);
    this.toast.info(this.translate.instant('chatEntry.undone'));
  }

  edit(): void {
    const current = this.created();
    if (!current) return;
    void this.router.navigate(['/activities', current.activity.id]);
  }

  dismiss(): void {
    this.created.set(null);
  }

  private handleFailure(err: unknown): void {
    if (err instanceof ChatEntryError && err.kind === 'not-understood') {
      // Not an outage: the farmer's wording just did not carry an activity.
      // Keep their text so they can adjust it instead of retyping.
      this.notUnderstood.set(true);
      return;
    }
    // Anything else means the feature is unavailable. Say so plainly and
    // point at the form, which always works.
    this.toast.error(this.translate.instant('chatEntry.unavailable'));
  }
}
