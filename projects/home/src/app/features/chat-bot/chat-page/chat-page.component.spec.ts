import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';

import { ChatPageComponent } from './chat-page.component';
import { ChatOrchestratorService } from '../chat-orchestrator.service';

describe('ChatPageComponent', () => {
  let fixture: ComponentFixture<ChatPageComponent>;
  let orchestrator: Record<string, unknown>;

  beforeEach(async () => {
    orchestrator = {
      messages: signal([{ role: 'bot', text: 'Namaste' }]),
      busy: signal(false),
      hasMoreHistory: signal(false),
      onOpen: jasmine.createSpy('onOpen').and.resolveTo(),
      suggestions: jasmine.createSpy('suggestions').and.returnValue([]),
      sendText: jasmine.createSpy('sendText'),
      selectChip: jasmine.createSpy('selectChip'),
      loadOlder: jasmine.createSpy('loadOlder'),
      clearHistory: jasmine.createSpy('clearHistory'),
      requestReview: jasmine.createSpy('requestReview'),
    };
    await TestBed.configureTestingModule({
      imports: [ChatPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideTranslateService(),
        { provide: ChatOrchestratorService, useValue: orchestrator },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
  });

  it('restores the conversation when it opens', () => {
    expect(orchestrator['onOpen']).toHaveBeenCalledTimes(1);
  });

  it('shows the shared conversation in the page layout, without close or expand', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Namaste');
    expect(el.querySelector('.btn-close')).toBeNull();
    expect(el.querySelector('.chat-panel__expand')).toBeNull();
  });

  it('sends typed text and asks for the review popup through the shared orchestrator', () => {
    const panel = fixture.debugElement.children[0];
    panel.triggerEventHandler('send', 'hello');
    panel.triggerEventHandler('reviewRequested');

    expect(orchestrator['sendText']).toHaveBeenCalledWith('hello');
    expect(orchestrator['requestReview']).toHaveBeenCalled();
  });
});
