import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { ChatEntryError, ChatEntryService, ResolvedEntry } from '../../core/api/chat-entry.service';
import { CropsApiService } from '../../core/api/crops-api.service';
import { LandsApiService } from '../../core/api/lands-api.service';
import { ChatMessage, ChatQuickReply } from './chat-bot.models';
import { ClarifyField, RoundCounts, correctionSentence, decideNextStep } from './chat-decision';

/** What the manual-form escape hatch needs to pre-fill (#256's requirement). */
export interface ChatEscapeHatch {
  field: ClarifyField;
  entry: ResolvedEntry;
}

/**
 * Conversation orchestration (#258): parse → resolve → decide, one field at
 * a time. Drives `ChatPanelComponent` via signals — this service owns the
 * message thread, `ChatPanelComponent` (#257) only renders it.
 *
 * The whole accumulated text is re-parsed on every turn, never patched
 * locally — the model needs full context to stay consistent, same reasoning
 * as #232/#241's original design. Chip data (`getFarms`/`getCrops`) is
 * fetched fresh every round; nothing here caches it (#256 review comment).
 */
@Injectable()
export class ChatOrchestratorService {
  private readonly chatEntry = inject(ChatEntryService);
  private readonly lands = inject(LandsApiService);
  private readonly crops = inject(CropsApiService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  private readonly messagesSignal = signal<ChatMessage[]>([]);
  private readonly busySignal = signal(false);
  private readonly draftSignal = signal<ResolvedEntry | null>(null);
  private readonly escapeHatchSignal = signal<ChatEscapeHatch | null>(null);
  private readonly modelSignal = signal<string | null>(null);
  private readonly originalInputSignal = signal('');

  readonly messages = this.messagesSignal.asReadonly();
  readonly busy = this.busySignal.asReadonly();
  readonly draft = this.draftSignal.asReadonly();
  readonly escapeHatch = this.escapeHatchSignal.asReadonly();
  readonly model = this.modelSignal.asReadonly();
  readonly originalInput = this.originalInputSignal.asReadonly();
  readonly ready = computed(() => this.draftSignal() !== null);

  private accumulatedText = '';
  private roundCounts: RoundCounts = {};
  private currentField: ClarifyField | null = null;

  /** Start a fresh conversation — called when the chat panel opens or a farmer saves/cancels an entry. */
  reset(): void {
    this.messagesSignal.set([]);
    this.busySignal.set(false);
    this.draftSignal.set(null);
    this.escapeHatchSignal.set(null);
    this.modelSignal.set(null);
    this.originalInputSignal.set('');
    this.accumulatedText = '';
    this.roundCounts = {};
    this.currentField = null;
  }

  async sendText(text: string): Promise<void> {
    if (this.busySignal()) return;

    if (!this.accumulatedText) {
      this.originalInputSignal.set(text);
    }
    this.appendFarmerMessage(text);
    this.accumulatedText = this.accumulatedText ? `${this.accumulatedText} ${text}` : text;
    await this.runParse();
  }

  async selectChip(chip: ChatQuickReply): Promise<void> {
    if (this.busySignal() || !this.currentField) return;

    this.appendFarmerMessage(chip.label);
    this.accumulatedText = `${this.accumulatedText} ${correctionSentence(this.currentField, chip.label)}`;
    await this.runParse();
  }

  private appendFarmerMessage(text: string): void {
    this.messagesSignal.update((m) => [...m, { role: 'farmer', text }]);
  }

  private appendBotMessage(
    text: string,
    chips?: ChatQuickReply[],
    showReviewAction?: boolean,
  ): void {
    this.messagesSignal.update((m) => [...m, { role: 'bot', text, chips, showReviewAction }]);
  }

  private async runParse(): Promise<void> {
    this.busySignal.set(true);
    try {
      const { parsed, model } = await this.chatEntry.parse(this.accumulatedText);
      this.modelSignal.set(model);

      const userId = this.auth.currentUser()?.id ?? 0;
      const [lands, crops] = await Promise.all([
        this.lands.getFarms(userId),
        this.crops.getCrops(userId),
      ]);

      const { decision, rounds } = decideNextStep(parsed, this.roundCounts, {
        lands: lands.map((l) => ({ id: l.id, name: l.name })),
        crops: crops.map((c) => ({ id: c.id, name: c.name })),
      });
      this.roundCounts = rounds;

      if (decision.kind === 'ready') {
        this.currentField = null;
        this.draftSignal.set(decision.entry);
        this.appendBotMessage(this.translate.instant('chatBot.readyToReview'), undefined, true);
      } else if (decision.kind === 'clarify') {
        this.currentField = decision.field;
        this.appendBotMessage(
          this.translate.instant(`chatBot.clarify.${decision.field}`),
          decision.options,
        );
      } else {
        this.currentField = null;
        this.escapeHatchSignal.set({ field: decision.field, entry: decision.entry });
        this.appendBotMessage(this.translate.instant('chatBot.escapeHatch'));
      }
    } catch (err) {
      this.currentField = null;
      if (err instanceof ChatEntryError && err.kind === 'not-understood') {
        this.appendBotMessage(this.translate.instant('chatBot.rephrase'));
      } else {
        this.appendBotMessage(this.translate.instant('chatBot.unavailable'));
      }
    } finally {
      this.busySignal.set(false);
    }
  }
}
