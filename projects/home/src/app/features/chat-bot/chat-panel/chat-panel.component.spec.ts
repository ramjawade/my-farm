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

    const chipButtons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('.chat-panel__bubble button');
    chipButtons[0].click();
    fixture.detectChanges();

    expect(selected).toHaveBeenCalledWith({ label: 'North Plot', value: '12' });

    const bubbles = fixture.nativeElement.querySelectorAll('.chat-panel__bubble');
    expect(bubbles.length).toBe(2);
    expect(bubbles[1].textContent).toContain('North Plot');
  });

  it('clears the chip echo once the orchestrator supplies a new messages array', () => {
    setMessages([{ role: 'bot', text: 'Which land?', chips: [{ label: 'North Plot', value: '12' }] }]);

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

  it('emits close when the close button is tapped', () => {
    fixture.detectChanges();
    const closed = jasmine.createSpy('close');
    component.close.subscribe(closed);

    fixture.nativeElement.querySelector('.btn-close').click();

    expect(closed).toHaveBeenCalled();
  });
});
