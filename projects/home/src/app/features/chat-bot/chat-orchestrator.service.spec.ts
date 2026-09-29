import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import {
  AskResponse,
  AssistantApiService,
  AssistantMessage,
  BriefResponse,
} from '../../core/api/assistant-api.service';
import { ChatEntryError, ChatEntryService, ResolvedEntry } from '../../core/api/chat-entry.service';
import { CropsApiService } from '../../core/api/crops-api.service';
import { LandsApiService } from '../../core/api/lands-api.service';
import { ChatOrchestratorService } from './chat-orchestrator.service';
import { MAX_CLARIFY_ROUNDS } from './chat-decision';

function entry(overrides: Partial<ResolvedEntry> = {}): ResolvedEntry {
  return {
    transcript: '100 rs fertilizer',
    activity_type_id: 1,
    activity_type: 'Fertilizer Application',
    date: '2026-09-20',
    crop_id: 1,
    crop: 'Wheat',
    land_id: 1,
    land: 'North Plot',
    notes: null,
    expenses: [],
    dropped: [],
    ...overrides,
  };
}

function reply(overrides: Partial<AskResponse> = {}): AskResponse {
  return { intent: 'question', answer: null, needs_clarification: null, ...overrides };
}

function briefResponse(overrides: Partial<BriefResponse> = {}): BriefResponse {
  return { has_data: true, name: null, weather: null, pending: null, spend_7d: null, ...overrides };
}

function saved(
  id: number,
  role: 'farmer' | 'bot',
  text: string,
  overrides: Partial<AssistantMessage> = {},
): AssistantMessage {
  return { id, role, kind: 'text', text, created_at: new Date().toISOString(), ...overrides };
}

const DAY_MS = 86_400_000;

/** Let queued promise callbacks (the best-effort saves) run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

describe('ChatOrchestratorService', () => {
  let service: ChatOrchestratorService;
  let assistant: jasmine.SpyObj<AssistantApiService>;
  let chatEntry: jasmine.SpyObj<ChatEntryService>;
  let lands: jasmine.SpyObj<LandsApiService>;
  let crops: jasmine.SpyObj<CropsApiService>;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    chatEntry = jasmine.createSpyObj('ChatEntryService', ['parse']);
    assistant = jasmine.createSpyObj('AssistantApiService', [
      'ask',
      'brief',
      'listMessages',
      'appendMessages',
      'clearMessages',
    ]);
    // Most tests are about logging, so a fresh message routes to "log" by default.
    assistant.ask.and.resolveTo(reply({ intent: 'log' }));
    assistant.listMessages.and.resolveTo({ items: [], has_more: false });
    assistant.appendMessages.and.resolveTo([]);
    assistant.brief.and.resolveTo(briefResponse({ has_data: false }));
    assistant.clearMessages.and.resolveTo();
    lands = jasmine.createSpyObj('LandsApiService', ['getFarms']);
    crops = jasmine.createSpyObj('CropsApiService', ['getCrops']);
    auth = jasmine.createSpyObj('AuthService', ['currentUser']);
    lands.getFarms.and.resolveTo([{ id: 1, name: 'North Plot' }] as never);
    crops.getCrops.and.resolveTo([{ id: 1, name: 'Wheat' }] as never);
    auth.currentUser.and.returnValue({ id: 7 } as never);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideTranslateService(),
        ChatOrchestratorService,
        { provide: ChatEntryService, useValue: chatEntry },
        { provide: AssistantApiService, useValue: assistant },
        { provide: LandsApiService, useValue: lands },
        { provide: CropsApiService, useValue: crops },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(ChatOrchestratorService);
  });

  it('appends the farmer message immediately, then a bot "ready" message when nothing is dropped', async () => {
    chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'gemini-3.1-flash-lite' });

    const promise = service.sendText('100 rs fertilizer on north plot');
    expect(service.messages()).toEqual([
      { role: 'farmer', text: '100 rs fertilizer on north plot' },
    ]);
    expect(service.busy()).toBeTrue();

    await promise;

    expect(service.busy()).toBeFalse();
    expect(service.ready()).toBeTrue();
    expect(service.draft()).toEqual(entry());
    expect(service.messages().length).toBe(2);
    expect(service.messages()[1].role).toBe('bot');
    expect(service.originalInput()).toBe('100 rs fertilizer on north plot');
    expect(service.model()).toBe('gemini-3.1-flash-lite');
  });

  it("asks a clarifying question with chips built from the farmer's own lands", async () => {
    chatEntry.parse.and.resolveTo({
      parsed: entry({
        land: null,
        land_id: null,
        dropped: [{ field: 'land', value: 'norht plot', reason: 'not_found' }],
      }),
      model: 'gemini-3.1-flash-lite',
    });

    await service.sendText('100 rs fertilizer on norht plot');

    expect(service.ready()).toBeFalse();
    const lastMessage = service.messages().at(-1)!;
    expect(lastMessage.role).toBe('bot');
    expect(lastMessage.chips).toEqual([{ label: 'North Plot', value: '1' }]);
  });

  it('re-invokes parse with the accumulated text (never a partial patch) when a chip is tapped', async () => {
    chatEntry.parse.and.resolveTo({
      parsed: entry({
        land: null,
        land_id: null,
        dropped: [{ field: 'land', value: 'norht plot', reason: 'not_found' }],
      }),
      model: 'gemini-3.1-flash-lite',
    });
    await service.sendText('100 rs fertilizer on norht plot');

    chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'gemini-3.1-flash-lite' });
    await service.selectChip({ label: 'North Plot', value: '1' });

    expect(chatEntry.parse).toHaveBeenCalledTimes(2);
    const secondCallText = chatEntry.parse.calls.argsFor(1)[0] as string;
    expect(secondCallText).toContain('100 rs fertilizer on norht plot');
    expect(secondCallText).toContain('Land: North Plot.');
    expect(service.ready()).toBeTrue();
  });

  it('fetches lands and crops fresh on every round, never caching them', async () => {
    chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'm' });
    await service.sendText('first');
    await service.sendText('second');

    expect(lands.getFarms).toHaveBeenCalledTimes(2);
    expect(crops.getCrops).toHaveBeenCalledTimes(2);
  });

  it('offers the manual-form escape hatch after MAX_CLARIFY_ROUNDS failed rounds on the same field', async () => {
    const stillDropped = entry({
      land: null,
      land_id: null,
      dropped: [{ field: 'land', value: 'somewhere', reason: 'not_found' }],
    });
    chatEntry.parse.and.resolveTo({ parsed: stillDropped, model: 'm' });

    for (let i = 0; i <= MAX_CLARIFY_ROUNDS; i++) {
      await service.sendText(`attempt ${i}`);
    }

    expect(service.escapeHatch()).toEqual({ field: 'land', entry: stillDropped });
    expect(service.ready()).toBeFalse();
  });

  it('turns a 422 into a rephrase prompt, not a thrown error', async () => {
    chatEntry.parse.and.rejectWith(new ChatEntryError('not-understood'));

    await expectAsync(service.sendText('gibberish')).toBeResolved();

    expect(service.messages().at(-1)?.role).toBe('bot');
    expect(service.busy()).toBeFalse();
  });

  it('turns anything else into an unavailable message', async () => {
    chatEntry.parse.and.rejectWith(new ChatEntryError('unavailable'));

    await service.sendText('100 rs fertilizer');

    expect(service.messages().at(-1)?.role).toBe('bot');
    expect(service.ready()).toBeFalse();
  });

  it('reset() clears the conversation back to empty', async () => {
    chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'm' });
    await service.sendText('100 rs fertilizer');

    service.reset();

    expect(service.messages()).toEqual([]);
    expect(service.draft()).toBeNull();
    expect(service.originalInput()).toBe('');
  });

  describe('routing a fresh message (#290)', () => {
    it('sends the text and the app language to /ask, then continues as a log entry', async () => {
      spyOn(TestBed.inject(TranslateService), 'getCurrentLang').and.returnValue('mr');
      chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'm' });

      await service.sendText('100 rs fertilizer');

      expect(assistant.ask).toHaveBeenCalledOnceWith('100 rs fertilizer', 'mr');
      expect(chatEntry.parse).toHaveBeenCalledOnceWith('100 rs fertilizer');
      expect(service.originalInput()).toBe('100 rs fertilizer');
      expect(service.ready()).toBeTrue();
    });

    it('shows the answer to a question without parsing or touching the entry', async () => {
      assistant.ask.and.resolveTo(reply({ answer: 'You spent ₹250.' }));

      await service.sendText('how much did I spend?');

      expect(chatEntry.parse).not.toHaveBeenCalled();
      expect(service.messages()).toEqual([
        { role: 'farmer', text: 'how much did I spend?' },
        { role: 'bot', text: 'You spent ₹250.', chips: undefined, showReviewAction: undefined },
      ]);
      expect(service.originalInput()).toBe('');
      expect(service.busy()).toBeFalse();
    });

    it('keeps a ready entry intact when the farmer asks a question in the meantime', async () => {
      chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'm' });
      await service.sendText('100 rs fertilizer');

      assistant.ask.and.resolveTo(reply({ answer: 'You spent ₹250.' }));
      await service.sendText('how much did I spend?');

      expect(service.ready()).toBeTrue();
      expect(service.draft()).toEqual(entry());
      expect(chatEntry.parse).toHaveBeenCalledTimes(1);
    });

    it('answers an unsupported message with the help text and example-question chips', async () => {
      assistant.ask.and.resolveTo(reply({ intent: 'unsupported' }));

      await service.sendText('tell me a joke');

      const bot = service.messages().at(-1)!;
      expect(bot.text).toBe('chatBot.assistant.help');
      expect(bot.chips?.map((c) => c.kind)).toEqual(['suggestion', 'suggestion', 'suggestion']);
      expect(chatEntry.parse).not.toHaveBeenCalled();
    });

    it('sends a tapped example question as a fresh message', async () => {
      assistant.ask.and.resolveTo(reply({ intent: 'unsupported' }));
      await service.sendText('tell me a joke');
      const chip = service.messages().at(-1)!.chips![0];

      assistant.ask.and.resolveTo(reply({ answer: 'You spent ₹250.' }));
      await service.selectChip(chip);

      expect(assistant.ask).toHaveBeenCalledTimes(2);
      expect(assistant.ask.calls.mostRecent().args[0]).toBe(chip.value);
      expect(service.messages().at(-1)?.text).toBe('You spent ₹250.');
    });

    it("offers the farmer's own crops when the crop is unknown, then re-asks with the pick", async () => {
      assistant.ask.and.resolveTo(
        reply({ needs_clarification: { field: 'crop', reason: 'unknown', options: ['Wheat'] } }),
      );
      await service.sendText('and for the cotton?');

      const bot = service.messages().at(-1)!;
      expect(bot.text).toBe('chatBot.assistant.clarify.crop.unknown');
      expect(bot.chips).toEqual([{ label: 'Wheat', value: 'Wheat' }]);

      assistant.ask.and.resolveTo(reply({ answer: '₹18,450 on wheat.' }));
      await service.selectChip(bot.chips![0]);

      expect(assistant.ask.calls.mostRecent().args[0]).toBe('and for the cotton? Crop: Wheat.');
      expect(service.messages().at(-1)?.text).toBe('₹18,450 on wheat.');
      expect(chatEntry.parse).not.toHaveBeenCalled();
    });

    it('drops a pending question when the farmer types instead of tapping a chip', async () => {
      assistant.ask.and.resolveTo(
        reply({ needs_clarification: { field: 'land', reason: 'ambiguous', options: ['Back'] } }),
      );
      await service.sendText('spend on back field?');
      const chip = service.messages().at(-1)!.chips![0];

      assistant.ask.and.resolveTo(reply({ answer: 'ok' }));
      await service.sendText('what is pending?');
      assistant.ask.calls.reset();
      await service.selectChip(chip);

      expect(assistant.ask).not.toHaveBeenCalled();
    });

    it('does not route a reply to a clarification the bot asked for', async () => {
      chatEntry.parse.and.resolveTo({
        parsed: entry({
          land: null,
          land_id: null,
          dropped: [{ field: 'land', value: 'x', reason: 'not_found' }],
        }),
        model: 'm',
      });
      await service.sendText('100 rs fertilizer');
      expect(assistant.ask).toHaveBeenCalledTimes(1);

      chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'm' });
      await service.sendText('north plot');

      expect(assistant.ask).toHaveBeenCalledTimes(1);
      expect(chatEntry.parse).toHaveBeenCalledTimes(2);
      expect(chatEntry.parse.calls.argsFor(1)[0]).toBe('100 rs fertilizer north plot');
    });

    it('treats the message as a log entry when routing fails', async () => {
      assistant.ask.and.rejectWith({ status: 503 });
      chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'm' });

      await service.sendText('100 rs fertilizer');

      expect(chatEntry.parse).toHaveBeenCalledOnceWith('100 rs fertilizer');
      expect(service.ready()).toBeTrue();
    });

    it('still shows the unavailable message when routing and parsing both fail', async () => {
      assistant.ask.and.rejectWith({ status: 503 });
      chatEntry.parse.and.rejectWith(new ChatEntryError('unavailable'));

      await service.sendText('100 rs fertilizer');

      expect(service.messages().at(-1)?.text).toBe('chatBot.unavailable');
      expect(service.busy()).toBeFalse();
    });

    it('is busy while routing, and ignores input until it finishes', async () => {
      let finish!: (value: AskResponse) => void;
      assistant.ask.and.returnValue(new Promise<AskResponse>((resolve) => (finish = resolve)));

      const pending = service.sendText('how much?');
      expect(service.busy()).toBeTrue();
      await service.sendText('ignored while busy');
      expect(assistant.ask).toHaveBeenCalledTimes(1);

      finish(reply({ answer: 'done' }));
      await pending;
      expect(service.busy()).toBeFalse();
    });
  });

  describe('saving the conversation (#291)', () => {
    it('saves a turn as the farmer message and the bot reply in one call', async () => {
      assistant.ask.and.resolveTo(reply({ answer: 'You spent ₹250.' }));

      await service.sendText('how much did I spend?');
      await flush();

      expect(assistant.appendMessages).toHaveBeenCalledOnceWith([
        { role: 'farmer', kind: 'text', text: 'how much did I spend?' },
        { role: 'bot', kind: 'answer', text: 'You spent ₹250.' },
      ]);
    });

    it('saves the text only, never the chips or the Review & Save action', async () => {
      chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'm' });

      await service.sendText('100 rs fertilizer');
      await flush();

      const saved = assistant.appendMessages.calls.mostRecent().args[0];
      expect(saved).toEqual([
        { role: 'farmer', kind: 'text', text: '100 rs fertilizer' },
        { role: 'bot', kind: 'text', text: 'chatBot.readyToReview' },
      ]);
    });

    it('saves turns in the order they happened', async () => {
      assistant.ask.and.resolveTo(reply({ answer: 'first answer' }));
      await service.sendText('first');
      assistant.ask.and.resolveTo(reply({ answer: 'second answer' }));
      await service.sendText('second');
      await flush();

      const order = assistant.appendMessages.calls
        .allArgs()
        .flatMap(([messages]) => messages.map((m) => m.text));
      expect(order).toEqual(['first', 'first answer', 'second', 'second answer']);
    });

    it('carries on when a save fails, and keeps saving later turns', async () => {
      assistant.appendMessages.and.rejectWith({ status: 500 });
      assistant.ask.and.resolveTo(reply({ answer: 'still answered' }));

      await service.sendText('first');
      await flush();
      assistant.appendMessages.and.resolveTo([]);
      await service.sendText('second');
      await flush();

      expect(service.messages().at(-1)?.text).toBe('still answered');
      expect(assistant.appendMessages).toHaveBeenCalledTimes(2);
    });

    it('trims a saved message to what the backend accepts instead of dropping it', async () => {
      assistant.ask.and.resolveTo(reply({ answer: 'x'.repeat(5000) }));

      await service.sendText('long');
      await flush();

      const bot = assistant.appendMessages.calls.mostRecent().args[0][1];
      expect(bot.text.length).toBe(4000);
    });
  });

  describe('opening the chat (#291)', () => {
    it('does nothing until it is opened', () => {
      expect(assistant.listMessages).not.toHaveBeenCalled();
      expect(assistant.brief).not.toHaveBeenCalled();
    });

    it('restores saved messages oldest-first, with their times', async () => {
      const at = new Date(Date.now() - 2 * DAY_MS).toISOString();
      assistant.listMessages.and.resolveTo({
        // The backend sends newest first.
        items: [saved(12, 'bot', 'answer', { created_at: at }), saved(11, 'farmer', 'question')],
        has_more: true,
      });
      assistant.brief.and.resolveTo(briefResponse());

      await service.onOpen();

      expect(
        service
          .messages()
          .slice(0, 2)
          .map((m) => m.text),
      ).toEqual(['question', 'answer']);
      expect(service.messages()[1].createdAt).toBe(at);
      expect(service.hasMoreHistory()).toBeTrue();
      expect(assistant.listMessages).toHaveBeenCalledOnceWith(50);
    });

    it('restores history once per session, however often it is opened', async () => {
      await service.onOpen();
      await service.onOpen();

      expect(assistant.listMessages).toHaveBeenCalledTimes(1);
    });

    it('adds the brief when none has been shown today, with example chips and its kind', async () => {
      assistant.brief.and.resolveTo(
        briefResponse({ name: 'Ramesh Kumar', spend_7d: { total: 500 } }),
      );

      await service.onOpen();
      await flush();

      const brief = service.messages().at(-1)!;
      expect(brief.role).toBe('bot');
      expect(brief.kind).toBe('brief');
      expect(brief.text).toContain('chatBot.brief.greeting');
      expect(brief.chips?.map((c) => c.kind)).toEqual(['suggestion', 'suggestion']);
      expect(assistant.appendMessages.calls.mostRecent().args[0][0].kind).toBe('brief');
    });

    it('does not fetch the brief when history already has one from today', async () => {
      assistant.listMessages.and.resolveTo({
        items: [saved(5, 'bot', 'Hello 🌱', { kind: 'brief' })],
        has_more: false,
      });

      await service.onOpen();

      expect(assistant.brief).not.toHaveBeenCalled();
    });

    it('fetches a new brief when the last one is from a previous day', async () => {
      assistant.listMessages.and.resolveTo({
        items: [
          saved(5, 'bot', 'Hello 🌱', {
            kind: 'brief',
            created_at: new Date(Date.now() - 2 * DAY_MS).toISOString(),
          }),
        ],
        has_more: false,
      });

      await service.onOpen();

      expect(assistant.brief).toHaveBeenCalledTimes(1);
    });

    it('does not fetch the brief again when the chat is reopened the same day', async () => {
      await service.onOpen();
      await service.onOpen();

      expect(assistant.brief).toHaveBeenCalledTimes(1);
    });

    it('shows no brief, and retries history next time, when history could not be loaded', async () => {
      assistant.listMessages.and.rejectWith({ status: 500 });

      await service.onOpen();
      expect(assistant.brief).not.toHaveBeenCalled();
      expect(service.messages()).toEqual([]);

      assistant.listMessages.and.resolveTo({ items: [], has_more: false });
      await service.onOpen();
      expect(assistant.brief).toHaveBeenCalledTimes(1);
    });

    it('ignores a failed brief without disturbing the chat', async () => {
      assistant.brief.and.rejectWith({ status: 500 });

      await expectAsync(service.onOpen()).toBeResolved();

      expect(service.messages()).toEqual([]);
    });

    it('drops the brief if the farmer started typing while it loaded', async () => {
      let finish!: (value: BriefResponse) => void;
      assistant.brief.and.returnValue(new Promise<BriefResponse>((resolve) => (finish = resolve)));
      assistant.ask.and.resolveTo(reply({ answer: 'quick answer' }));

      const opening = service.onOpen();
      await flush();
      await service.sendText('hello');
      finish(briefResponse());
      await opening;

      expect(service.messages().map((m) => m.text)).toEqual(['hello', 'quick answer']);
    });

    it('does not run two opens at once', async () => {
      await Promise.all([service.onOpen(), service.onOpen()]);

      expect(assistant.listMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe('older history (#291)', () => {
    beforeEach(async () => {
      assistant.listMessages.and.resolveTo({
        items: [saved(20, 'bot', 'newer'), saved(19, 'farmer', 'new question')],
        has_more: true,
      });
      assistant.brief.and.resolveTo(briefResponse());
      await service.onOpen();
      assistant.listMessages.calls.reset();
    });

    it('prepends the previous page, paging from the oldest message shown', async () => {
      assistant.listMessages.and.resolveTo({
        items: [saved(18, 'bot', 'older answer'), saved(17, 'farmer', 'older question')],
        has_more: false,
      });

      await service.loadOlder();

      expect(assistant.listMessages).toHaveBeenCalledOnceWith(50, 19);
      expect(
        service
          .messages()
          .slice(0, 4)
          .map((m) => m.text),
      ).toEqual(['older question', 'older answer', 'new question', 'newer']);
      expect(service.hasMoreHistory()).toBeFalse();
    });

    it('does nothing once there is no more history', async () => {
      assistant.listMessages.and.resolveTo({ items: [], has_more: false });
      await service.loadOlder();
      assistant.listMessages.calls.reset();

      await service.loadOlder();

      expect(assistant.listMessages).not.toHaveBeenCalled();
    });

    it('keeps the button available after a failed load', async () => {
      assistant.listMessages.and.rejectWith({ status: 500 });
      await service.loadOlder();

      expect(service.hasMoreHistory()).toBeTrue();
      expect(service.messages().length).toBeGreaterThan(0);
    });
  });

  describe('clearing and ending an entry (#291)', () => {
    it('deletes the saved history and empties the thread', async () => {
      assistant.listMessages.and.resolveTo({
        items: [saved(2, 'bot', 'hi')],
        has_more: true,
      });
      assistant.brief.and.resolveTo(briefResponse());
      await service.onOpen();

      const cleared = await service.clearHistory();

      expect(cleared).toBeTrue();
      expect(assistant.clearMessages).toHaveBeenCalled();
      expect(service.messages()).toEqual([]);
      expect(service.hasMoreHistory()).toBeFalse();
    });

    it('does not bring the brief back after clearing the same day', async () => {
      await service.onOpen();
      await service.clearHistory();

      await service.onOpen();

      expect(assistant.brief).toHaveBeenCalledTimes(1);
    });

    it('waits for saves in flight so they cannot resurrect cleared messages', async () => {
      const order: string[] = [];
      assistant.appendMessages.and.callFake(async () => {
        await flush();
        order.push('saved');
        return [];
      });
      assistant.clearMessages.and.callFake(async () => {
        order.push('cleared');
      });
      assistant.ask.and.resolveTo(reply({ answer: 'answer' }));

      await service.sendText('question');
      await service.clearHistory();

      expect(order).toEqual(['saved', 'cleared']);
    });

    it('keeps the thread and says so when the delete fails, without saving that note', async () => {
      assistant.ask.and.resolveTo(reply({ answer: 'answer' }));
      await service.sendText('question');
      await flush();
      assistant.appendMessages.calls.reset();
      assistant.clearMessages.and.rejectWith({ status: 500 });

      const cleared = await service.clearHistory();
      await flush();

      expect(cleared).toBeFalse();
      expect(service.messages().map((m) => m.text)).toEqual([
        'question',
        'answer',
        'chatBot.clearFailed',
      ]);
      expect(assistant.appendMessages).not.toHaveBeenCalled();
    });

    it('endEntry() drops the draft but keeps the thread', async () => {
      chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'm' });
      await service.sendText('100 rs fertilizer');
      expect(service.ready()).toBeTrue();

      service.endEntry();

      expect(service.ready()).toBeFalse();
      expect(service.originalInput()).toBe('');
      expect(service.messages().length).toBe(2);
    });

    it('starts a fresh entry after endEntry() instead of appending to the old one', async () => {
      chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'm' });
      await service.sendText('100 rs fertilizer');
      service.endEntry();

      await service.sendText('200 rs seeds');

      expect(chatEntry.parse.calls.mostRecent().args[0]).toBe('200 rs seeds');
    });
  });
});
