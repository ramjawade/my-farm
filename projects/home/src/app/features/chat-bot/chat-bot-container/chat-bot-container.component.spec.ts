import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { ChatBotContainerComponent } from './chat-bot-container.component';
import { ChatOrchestratorService } from '../chat-orchestrator.service';
import { ChatEntryService, ResolvedEntry } from '../../../core/api/chat-entry.service';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { LandsApiService } from '../../../core/api/lands-api.service';
import { FakeLandsApiService } from '../../../testing/fake-lands-api.service';
import { CropsApiService } from '../../../core/api/crops-api.service';
import { FakeCropsApiService } from '../../../testing/fake-crops-api.service';
import { AuthService } from '../../../core/auth/auth.service';

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
    dropped: [{ field: 'land', value: 'somewhere', reason: 'not_found' }],
    ...overrides,
  };
}

describe('ChatBotContainerComponent', () => {
  let fixture: ComponentFixture<ChatBotContainerComponent>;
  let component: ChatBotContainerComponent;
  let router: Router;
  let fakeOrchestrator: {
    messages: ReturnType<typeof signal>;
    busy: ReturnType<typeof signal>;
    draft: ReturnType<typeof signal>;
    escapeHatch: ReturnType<typeof signal>;
    model: ReturnType<typeof signal>;
    originalInput: ReturnType<typeof signal>;
    reset: jasmine.Spy;
    sendText: jasmine.Spy;
    selectChip: jasmine.Spy;
  };

  beforeEach(async () => {
    fakeOrchestrator = {
      messages: signal([]),
      busy: signal(false),
      draft: signal(null),
      escapeHatch: signal(null),
      model: signal<string | null>(null),
      originalInput: signal(''),
      reset: jasmine.createSpy('reset'),
      sendText: jasmine.createSpy('sendText'),
      selectChip: jasmine.createSpy('selectChip'),
    };

    await TestBed.configureTestingModule({
      imports: [ChatBotContainerComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService(),
        // ReviewPopupComponent is always instantiated (its own template gates
        // visibility internally), so its dependencies need real DI targets
        // even though the popup itself stays invisible in most of these tests.
        {
          provide: ChatEntryService,
          useValue: jasmine.createSpyObj('ChatEntryService', ['create']),
        },
        {
          provide: ReferenceDataService,
          useValue: jasmine.createSpyObj('ReferenceDataService', {
            listActivityTypes: Promise.resolve([]),
          }),
        },
        { provide: LandsApiService, useClass: FakeLandsApiService },
        { provide: CropsApiService, useClass: FakeCropsApiService },
        {
          provide: AuthService,
          useValue: jasmine.createSpyObj('AuthService', { currentUser: null }),
        },
      ],
    })
      .overrideComponent(ChatBotContainerComponent, {
        set: { providers: [{ provide: ChatOrchestratorService, useValue: fakeOrchestrator }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ChatBotContainerComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  });

  it('shows the FAB when closed and the chat overlay once opened', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.chat-fab')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.chat-bot-overlay')).toBeNull();

    component.openChat();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.chat-fab')).toBeNull();
    expect(fixture.nativeElement.querySelector('.chat-bot-overlay')).toBeTruthy();
  });

  it('only shows the review popup after reviewRequested, driven by the draft entry', () => {
    fixture.detectChanges();
    expect(component.reviewEntry()).toBeNull();

    fakeOrchestrator.draft.set(entry({ dropped: [] }));
    fixture.detectChanges();
    expect(component.reviewEntry()).toBeNull(); // ready, but not requested yet

    component.onReviewRequested();
    fixture.detectChanges();
    expect(component.reviewEntry()).toEqual(entry({ dropped: [] }));
  });

  it('closes the chat and resets the conversation once the popup reports saved', () => {
    component.openChat();
    component.onReviewRequested();
    fixture.detectChanges();

    component.onReviewSaved({ id: 1, type: 'Sowing', status: 'Completed' } as never);

    expect(component.open()).toBeFalse();
    expect(component.reviewEntry()).toBeNull();
    expect(fakeOrchestrator.reset).toHaveBeenCalled();
  });

  it('resets the conversation (discards the draft) on popup cancel, keeping the chat open', () => {
    component.openChat();
    component.onReviewRequested();

    component.onReviewCancelled();

    expect(component.open()).toBeTrue();
    expect(component.reviewEntry()).toBeNull();
    expect(fakeOrchestrator.reset).toHaveBeenCalled();
  });

  it('navigates to the manual create form pre-filled with resolved fields when the bot escalates', () => {
    fixture.detectChanges();
    component.openChat();

    fakeOrchestrator.escapeHatch.set({ field: 'land', entry: entry() });
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/activities/create'], {
      queryParams: {
        type: 'Fertilizer Application',
        date: '2026-09-20',
        cropId: 1,
        fieldId: 1,
        notes: undefined,
      },
    });
    expect(component.open()).toBeFalse();
    expect(fakeOrchestrator.reset).toHaveBeenCalled();
  });
});
