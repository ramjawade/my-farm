import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import {
  AskResponse,
  AssistantApiService,
  AssistantMessagesPage,
  NewAssistantMessage,
} from '../../core/api/assistant-api.service';
import { ChatEntryError, ChatEntryService, ResolvedEntry } from '../../core/api/chat-entry.service';
import { CropsApiService } from '../../core/api/crops-api.service';
import { LandsApiService } from '../../core/api/lands-api.service';
import { ChatMessage, ChatMessageKind, ChatQuickReply } from './chat-bot.models';
import { buildBriefText } from './chat-brief';
import { ClarifyField, RoundCounts, correctionSentence, decideNextStep } from './chat-decision';
import { localDay } from './chat-time';

/** How many saved messages to restore on open, and per "load older". */
const HISTORY_PAGE_SIZE = 50;
/** The backend rejects longer messages; a saved copy is trimmed rather than dropped. */
const MAX_SAVED_LENGTH = 4000;

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
 * A fresh message is routed first (#290): the backend says whether it is a
 * log entry (continue as below), a question (answered from the farmer's data)
 * or unsupported. A reply to a clarification the bot asked for is never
 * routed — it belongs to the entry or question that prompted it. If routing
 * fails for any reason the message is treated as a log entry, so the
 * assistant being down never blocks logging.
 *
 * Every turn is saved to the farmer's history (#291), best effort: a save
 * that fails never blocks the conversation. Opening the chat restores the
 * latest messages and, at most once a day, adds the daily brief. None of that
 * happens on construction: `onOpen()` is the only trigger, so an unopened
 * chat costs nothing.
 *
 * The whole accumulated text is re-parsed on every turn, never patched
 * locally — the model needs full context to stay consistent, same reasoning
 * as #232/#241's original design. Chip data (`getFarms`/`getCrops`) is
 * fetched fresh every round; nothing here caches it (#256 review comment).
 */
@Injectable()
export class ChatOrchestratorService {
  private readonly chatEntry = inject(ChatEntryService);
  private readonly assistant = inject(AssistantApiService);
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
  private readonly hasMoreHistorySignal = signal(false);

  readonly messages = this.messagesSignal.asReadonly();
  readonly busy = this.busySignal.asReadonly();
  readonly draft = this.draftSignal.asReadonly();
  readonly escapeHatch = this.escapeHatchSignal.asReadonly();
  readonly model = this.modelSignal.asReadonly();
  readonly originalInput = this.originalInputSignal.asReadonly();
  readonly ready = computed(() => this.draftSignal() !== null);
  /** Whether older saved messages can still be loaded. */
  readonly hasMoreHistory = this.hasMoreHistorySignal.asReadonly();

  private accumulatedText = '';
  private roundCounts: RoundCounts = {};
  private currentField: ClarifyField | null = null;
  /** A question the bot could not answer until the farmer picks a crop or land. */
  private pendingQuestion: { text: string; field: 'crop' | 'land' } | null = null;

  private historyLoaded = false;
  private opening = false;
  private loadingOlder = false;
  private oldestHistoryId: number | null = null;
  /** Local day the brief was last shown this session, so a cleared chat doesn't re-show it. */
  private briefDay: string | null = null;
  /** Messages waiting to be saved, and the chain that keeps saves in order. */
  private unsaved: NewAssistantMessage[] = [];
  private saveChain: Promise<void> = Promise.resolve();

  /**
   * Called each time the chat opens: restore saved messages (once per session),
   * then add today's brief if there isn't one yet. Explicit rather than an
   * `effect()`, so nothing fires on construction or on every navigation.
   */
  async onOpen(): Promise<void> {
    if (this.opening) return;
    this.opening = true;
    try {
      // Without history we can't tell whether a brief was already shown today.
      if (!this.historyLoaded && !(await this.loadHistory())) return;
      await this.showBriefIfDue();
    } finally {
      this.opening = false;
    }
  }

  /** Show the previous page of saved messages above the ones already shown. */
  async loadOlder(): Promise<void> {
    if (this.loadingOlder || this.oldestHistoryId === null || !this.hasMoreHistorySignal()) return;
    this.loadingOlder = true;
    try {
      this.prependHistory(
        await this.assistant.listMessages(HISTORY_PAGE_SIZE, this.oldestHistoryId),
      );
    } catch {
      // Leave the button in place so the farmer can try again.
    } finally {
      this.loadingOlder = false;
    }
  }

  /** Delete the saved history and empty the thread. Resolves false if the delete failed. */
  async clearHistory(): Promise<boolean> {
    // Let in-flight saves land first, or they would resurrect cleared messages.
    await this.saveChain;
    try {
      await this.assistant.clearMessages();
    } catch {
      // Shown, but deliberately not saved: it is a note about the chat, not part of it.
      this.messagesSignal.update((m) => [
        ...m,
        { role: 'bot', text: this.translate.instant('chatBot.clearFailed') },
      ]);
      return false;
    }
    this.reset();
    this.hasMoreHistorySignal.set(false);
    this.oldestHistoryId = null;
    return true;
  }

  /**
   * Finish the entry in progress (after a save, a cancel or the manual-form
   * escape hatch) but keep the thread: it is the farmer's history now.
   */
  endEntry(): void {
    this.busySignal.set(false);
    this.draftSignal.set(null);
    this.escapeHatchSignal.set(null);
    this.modelSignal.set(null);
    this.originalInputSignal.set('');
    this.accumulatedText = '';
    this.roundCounts = {};
    this.currentField = null;
    this.pendingQuestion = null;
  }

  /** Empty the thread as well as the entry state. Saved history is untouched, see `clearHistory`. */
  reset(): void {
    this.endEntry();
    this.messagesSignal.set([]);
    this.unsaved = [];
  }

  private async loadHistory(): Promise<boolean> {
    try {
      this.prependHistory(await this.assistant.listMessages(HISTORY_PAGE_SIZE));
      this.historyLoaded = true;
      return true;
    } catch {
      return false;
    }
  }

  /** `page` is newest-first; the thread reads oldest-first. */
  private prependHistory(page: AssistantMessagesPage): void {
    const restored: ChatMessage[] = page.items
      .map((m) => ({
        role: m.role,
        text: m.text,
        kind: m.kind,
        createdAt: m.created_at,
      }))
      .reverse();
    this.messagesSignal.update((current) => [...restored, ...current]);
    this.oldestHistoryId = page.items.at(-1)?.id ?? this.oldestHistoryId;
    this.hasMoreHistorySignal.set(page.has_more);
  }

  private async showBriefIfDue(): Promise<void> {
    const today = localDay(new Date());
    const alreadyShown =
      this.briefDay === today ||
      this.messagesSignal().some(
        (m) => m.kind === 'brief' && !!m.createdAt && localDay(new Date(m.createdAt)) === today,
      );
    if (alreadyShown) return;

    const before = this.messagesSignal().length;
    let brief;
    try {
      brief = await this.assistant.brief();
    } catch {
      return;
    }
    // The farmer started typing while it loaded; a greeting now would land mid-conversation.
    if (this.messagesSignal().length !== before) return;

    this.briefDay = today;
    this.appendBotMessage(
      buildBriefText(brief, (key, params) => this.translate.instant(key, params)),
      this.suggestionChips(['spend', 'pending']),
      undefined,
      'brief',
    );
  }
  async sendText(text: string): Promise<void> {
    if (this.busySignal()) return;

    this.appendFarmerMessage(text);
    // Typing instead of tapping a crop/land chip abandons the pending question.
    this.pendingQuestion = null;

    // Answering a clarification for the entry being logged: never routed.
    if (this.currentField) {
      this.accumulatedText = `${this.accumulatedText} ${text}`;
      await this.runParse();
      return;
    }

    await this.route(text);
  }

  async selectChip(chip: ChatQuickReply): Promise<void> {
    if (this.busySignal()) return;

    if (chip.kind === 'suggestion') {
      await this.sendText(chip.value);
      return;
    }

    if (this.pendingQuestion) {
      const { text, field } = this.pendingQuestion;
      this.pendingQuestion = null;
      this.appendFarmerMessage(chip.label);
      await this.route(`${text} ${correctionSentence(field, chip.label)}`);
      return;
    }

    if (!this.currentField) return;

    this.appendFarmerMessage(chip.label);
    this.accumulatedText = `${this.accumulatedText} ${correctionSentence(this.currentField, chip.label)}`;
    await this.runParse();
  }

  /** Ask the backend what a fresh message is, then act on the answer. */
  private async route(text: string): Promise<void> {
    this.busySignal.set(true);

    let response: AskResponse | null = null;
    try {
      response = await this.assistant.ask(text, this.translate.getCurrentLang() ?? undefined);
    } catch {
      // Routing is an enhancement: when it fails, logging still works.
      response = null;
    }

    if (!response || response.intent === 'log') {
      if (!this.accumulatedText) {
        this.originalInputSignal.set(text);
      }
      this.accumulatedText = this.accumulatedText ? `${this.accumulatedText} ${text}` : text;
      await this.runParse();
      return;
    }

    this.showAssistantReply(response, text);
    this.busySignal.set(false);
  }

  private showAssistantReply(response: AskResponse, questionText: string): void {
    const clarification = response.needs_clarification;
    if (clarification) {
      this.pendingQuestion = { text: questionText, field: clarification.field };
      this.appendBotMessage(
        this.translate.instant(
          `chatBot.assistant.clarify.${clarification.field}.${clarification.reason}`,
        ),
        clarification.options.map((name) => ({ label: name, value: name })),
      );
    } else if (response.answer) {
      this.appendBotMessage(response.answer, undefined, undefined, 'answer');
    } else {
      this.appendBotMessage(
        this.translate.instant('chatBot.assistant.help'),
        this.suggestionChips(),
      );
    }
  }

  private suggestionChips(keys: string[] = ['spend', 'pending', 'weather']): ChatQuickReply[] {
    return keys.map((key) => {
      const label = this.translate.instant(`chatBot.assistant.suggestions.${key}`);
      return { label, value: label, kind: 'suggestion' as const };
    });
  }

  private appendFarmerMessage(text: string): void {
    this.messagesSignal.update((m) => [...m, { role: 'farmer', text }]);
    this.unsaved.push({ role: 'farmer', kind: 'text', text });
  }

  private appendBotMessage(
    text: string,
    chips?: ChatQuickReply[],
    showReviewAction?: boolean,
    kind: ChatMessageKind = 'text',
  ): void {
    // Only the brief needs its kind in memory (to answer "shown today?").
    const message: ChatMessage = {
      role: 'bot',
      text,
      chips,
      showReviewAction,
      ...(kind === 'brief' ? { kind } : {}),
    };
    this.messagesSignal.update((m) => [...m, message]);
    this.unsaved.push({ role: 'bot', kind, text });
    this.save();
  }

  /**
   * Save the turn that just finished. Chips and the Review & Save button are
   * not saved: they mean nothing once the session is over. Best effort and
   * strictly ordered; a failure is dropped so the conversation carries on.
   */
  private save(): void {
    const batch = this.unsaved
      .splice(0)
      .filter((m) => m.text.trim() !== '')
      .map((m) => ({ ...m, text: m.text.slice(0, MAX_SAVED_LENGTH) }));
    // The backend takes at most two messages (one turn) per call.
    for (let i = 0; i < batch.length; i += 2) {
      const chunk = batch.slice(i, i + 2);
      this.saveChain = this.saveChain
        .then(() => this.assistant.appendMessages(chunk))
        .then(
          () => undefined,
          () => undefined,
        );
    }
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
