import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
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

describe('ChatOrchestratorService', () => {
  let service: ChatOrchestratorService;
  let chatEntry: jasmine.SpyObj<ChatEntryService>;
  let lands: jasmine.SpyObj<LandsApiService>;
  let crops: jasmine.SpyObj<CropsApiService>;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    chatEntry = jasmine.createSpyObj('ChatEntryService', ['parse']);
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
});
