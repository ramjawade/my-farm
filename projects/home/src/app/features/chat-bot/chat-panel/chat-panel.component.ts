import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { ChatMessage, ChatQuickReply } from '../chat-bot.models';

/** How many trailing messages stay at full opacity; earlier ones recede. */
const RECENT_MESSAGE_COUNT = 2;

/**
 * Chat thread + composer, presentation only (#257). No knowledge of
 * `/activities/parse` or any HTTP call — the orchestrator (#258) owns the
 * message list and reacts to `send`/`chipSelected`.
 *
 * A chip tap shows the farmer's choice immediately, as a local echo bubble,
 * without waiting for the orchestrator to fold it into `messages()`. The
 * echo is cleared as soon as `messages()` changes, since that's the
 * orchestrator taking over with the authoritative next state.
 */
@Component({
  selector: 'app-chat-panel',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPanelComponent {
  private readonly fb = inject(FormBuilder);

  readonly messages = input<ChatMessage[]>([]);
  readonly busy = input(false);

  readonly send = output<string>();
  readonly chipSelected = output<ChatQuickReply>();
  readonly close = output<void>();
  readonly reviewRequested = output<void>();

  private readonly threadEl = viewChild<ElementRef<HTMLDivElement>>('thread');
  private readonly pendingEcho = signal<ChatMessage | null>(null);

  readonly form = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  readonly displayMessages = computed(() => {
    const echo = this.pendingEcho();
    return echo ? [...this.messages(), echo] : this.messages();
  });

  constructor() {
    // A new `messages()` array means the orchestrator has responded — drop
    // the transient echo so the real thread isn't duplicated.
    effect(() => {
      this.messages();
      this.pendingEcho.set(null);
    });

    effect(() => {
      this.displayMessages();
      queueMicrotask(() => this.scrollToBottom());
    });
  }

  isRecent(index: number): boolean {
    return index >= this.displayMessages().length - RECENT_MESSAGE_COUNT;
  }

  submit(): void {
    if (this.form.invalid || this.busy()) return;
    const text = this.form.getRawValue().text.trim();
    if (!text) return;

    this.send.emit(text);
    this.form.reset();
  }

  onChipClick(chip: ChatQuickReply): void {
    this.pendingEcho.set({ role: 'farmer', text: chip.label });
    this.chipSelected.emit(chip);
  }

  onClose(): void {
    this.close.emit();
  }

  onReviewClick(): void {
    this.reviewRequested.emit();
  }

  private scrollToBottom(): void {
    const el = this.threadEl()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
