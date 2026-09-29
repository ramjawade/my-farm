import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';

import { ChatPanelComponent } from './chat-panel.component';
import { ChatMessage } from '../chat-bot.models';

describe('ChatPanelComponent', () => {
  let fixture: ComponentFixture<ChatPanelComponent>;
  let component: ChatPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatPanelComponent],
      providers: [provideZonelessChangeDetection(), provideTranslateService()],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatPanelComponent);
    component = fixture.componentInstance;
  });

  function setMessages(messages: ChatMessage[]): void {
    fixture.componentRef.setInput('messages', messages);
    fixture.detectChanges();
  }

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('renders each message bubble', () => {
    setMessages([
      { role: 'bot', text: 'What did you do today?' },
      { role: 'farmer', text: '100 rs fertilizer' },
    ]);

    const bubbles = fixture.nativeElement.querySelectorAll('.chat-panel__bubble');
    expect(bubbles.length).toBe(2);
    expect(bubbles[0].textContent).toContain('What did you do today?');
    expect(bubbles[1].textContent).toContain('100 rs fertilizer');
  });

  it('renders chips for a bot message and emits chipSelected on tap, echoing a farmer bubble', () => {
    setMessages([
      {
        role: 'bot',
        text: 'Which land?',
        chips: [
          { label: 'North Plot', value: '12' },
          { label: 'South Plot', value: '13' },
        ],
      },
    ]);

    const selected = jasmine.createSpy('chipSelected');
    component.chipSelected.subscribe(selected);

    const chipButtons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll(
      '.chat-panel__bubble button',
    );
    chipButtons[0].click();
    fixture.detectChanges();

    expect(selected).toHaveBeenCalledWith({ label: 'North Plot', value: '12' });

    const bubbles = fixture.nativeElement.querySelectorAll('.chat-panel__bubble');
    expect(bubbles.length).toBe(2);
    expect(bubbles[1].textContent).toContain('North Plot');
  });

  it('clears the chip echo once the orchestrator supplies a new messages array', () => {
    setMessages([
      { role: 'bot', text: 'Which land?', chips: [{ label: 'North Plot', value: '12' }] },
    ]);

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.chat-panel__bubble button',
    );
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.chat-panel__bubble').length).toBe(2);

    setMessages([
      { role: 'bot', text: 'Which land?', chips: [{ label: 'North Plot', value: '12' }] },
      { role: 'farmer', text: 'North Plot' },
      { role: 'bot', text: 'Got it — ready to review.' },
    ]);

    expect(fixture.nativeElement.querySelectorAll('.chat-panel__bubble').length).toBe(3);
  });

  it('emits send with the typed text and resets the composer', () => {
    fixture.detectChanges();
    const sent = jasmine.createSpy('send');
    component.send.subscribe(sent);

    component.form.controls.text.setValue('100 rs fertilizer on north plot');
    component.submit();

    expect(sent).toHaveBeenCalledWith('100 rs fertilizer on north plot');
    expect(component.form.controls.text.value).toBe('');
  });

  it('does not emit send when the composer is empty or busy', () => {
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    const sent = jasmine.createSpy('send');
    component.send.subscribe(sent);

    component.form.controls.text.setValue('   ');
    component.submit();

    expect(sent).not.toHaveBeenCalled();
  });

  it('renders the Review & Save action on a ready message and emits reviewRequested', () => {
    setMessages([
      { role: 'bot', text: "Got it — you're ready to review.", showReviewAction: true },
    ]);

    const requested = jasmine.createSpy('reviewRequested');
    component.reviewRequested.subscribe(requested);

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.chat-panel__bubble button',
    );
    button.click();

    expect(requested).toHaveBeenCalled();
  });

  it('emits close when the close button is tapped', () => {
    fixture.detectChanges();
    const closed = jasmine.createSpy('close');
    component.close.subscribe(closed);

    fixture.nativeElement.querySelector('.btn-close').click();

    expect(closed).toHaveBeenCalled();
  });

  describe('history and clearing (#291)', () => {
    const q = (selector: string): HTMLElement | null =>
      fixture.nativeElement.querySelector(selector);
    // Noon on the previous calendar day, whatever time the suite runs at.
    const yesterday = (() => {
      const day = new Date();
      day.setDate(day.getDate() - 1);
      day.setHours(12, 0, 0, 0);
      return day.toISOString();
    })();

    it('renders multi-line text one row per line inside a single bubble', () => {
      setMessages([{ role: 'bot', text: 'Hello 🌱\n📋 2 pending\n• Irrigation' }]);

      const bubble = q('.chat-panel__bubble')!;
      expect(Array.from(bubble.querySelectorAll('div')).map((d) => d.textContent)).toEqual([
        'Hello 🌱',
        '📋 2 pending',
        '• Irrigation',
      ]);
    });

    it('offers "load older" only when there is more history, and emits when tapped', () => {
      setMessages([{ role: 'bot', text: 'hi' }]);
      expect(fixture.nativeElement.textContent).not.toContain('chatBot.loadOlder');

      fixture.componentRef.setInput('hasMoreHistory', true);
      fixture.detectChanges();
      const loadOlder = jasmine.createSpy('loadOlder');
      component.loadOlder.subscribe(loadOlder);

      const button = Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((b) => b.textContent?.includes('chatBot.loadOlder'))!;
      button.click();

      expect(loadOlder).toHaveBeenCalled();
    });

    it('puts a heading above each new day, treating undated messages as today', () => {
      setMessages([
        { role: 'farmer', text: 'old question', createdAt: yesterday },
        { role: 'bot', text: 'old answer', createdAt: yesterday },
        { role: 'farmer', text: 'new question' },
      ]);

      const headings = Array.from(
        fixture.nativeElement.querySelectorAll('.chat-panel__thread .text-muted.small'),
      ).map((el) => (el as HTMLElement).textContent?.trim());
      expect(headings).toEqual(['chatBot.yesterday', 'chatBot.today']);
    });

    it('hides the clear button on an empty thread', () => {
      fixture.detectChanges();

      expect(q('[aria-label="chatBot.clear"]')).toBeNull();
    });

    it('asks for confirmation, and cancelling emits nothing', () => {
      setMessages([{ role: 'bot', text: 'hi' }]);
      const confirmed = jasmine.createSpy('clearConfirmed');
      component.clearConfirmed.subscribe(confirmed);

      q('[aria-label="chatBot.clear"]')!.click();
      fixture.detectChanges();
      expect(q('[role="alertdialog"]')).toBeTruthy();

      const cancel = Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('[role="alertdialog"] button'),
      ).find((b) => b.textContent?.includes('chatBot.clearConfirm.cancel'))!;
      cancel.click();
      fixture.detectChanges();

      expect(q('[role="alertdialog"]')).toBeNull();
      expect(confirmed).not.toHaveBeenCalled();
    });

    it('emits clearConfirmed only after the farmer confirms, then closes the dialog', () => {
      setMessages([{ role: 'bot', text: 'hi' }]);
      const confirmed = jasmine.createSpy('clearConfirmed');
      component.clearConfirmed.subscribe(confirmed);

      q('[aria-label="chatBot.clear"]')!.click();
      fixture.detectChanges();
      expect(confirmed).not.toHaveBeenCalled();

      q('[role="alertdialog"] .btn-danger')!.click();
      fixture.detectChanges();

      expect(confirmed).toHaveBeenCalledTimes(1);
      expect(q('[role="alertdialog"]')).toBeNull();
    });

    it('moves focus to the safe choice when the confirmation opens', () => {
      setMessages([{ role: 'bot', text: 'hi' }]);

      q('[aria-label="chatBot.clear"]')!.click();
      fixture.detectChanges();
      TestBed.tick();

      expect(document.activeElement?.textContent).toContain('chatBot.clearConfirm.cancel');
    });
  });
});
