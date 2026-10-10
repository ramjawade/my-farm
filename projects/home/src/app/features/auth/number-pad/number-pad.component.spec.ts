import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';

import { NumberPadComponent, PadKey } from './number-pad.component';

describe('NumberPadComponent', () => {
  let fixture: ComponentFixture<NumberPadComponent>;
  let host: HTMLElement;
  const tapped: PadKey[] = [];

  beforeEach(() => {
    tapped.length = 0;
    TestBed.configureTestingModule({
      imports: [NumberPadComponent],
      providers: [provideZonelessChangeDetection(), provideTranslateService()],
    });
    fixture = TestBed.createComponent(NumberPadComponent);
    fixture.componentInstance.key.subscribe((k) => tapped.push(k));
    host = fixture.nativeElement;
  });

  const key = (id: string) => host.querySelector<HTMLButtonElement>(`[data-testid="key-${id}"]`)!;

  it('shows twelve keys and reports the one tapped', async () => {
    fixture.detectChanges();
    expect(host.querySelectorAll('button').length).toBe(12);
    key('7').click();
    key('del').click();
    key('ok').click();
    expect(tapped).toEqual(['7', 'del', 'ok']);
  });

  it('shows Devanagari numerals only when asked', async () => {
    fixture.detectChanges();
    expect(host.querySelector('.pad-key__numeral')).toBeNull();
    fixture.componentRef.setInput('devanagari', true);
    fixture.detectChanges();
    expect(key('5').textContent).toContain('५');
    expect(key('0').textContent).toContain('०');
  });

  it('disables every key and shows a spinner on Next while busy', async () => {
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    host.querySelectorAll('button').forEach((b) => expect(b.disabled).toBeTrue());
    expect(key('ok').querySelector('.spinner-border')).not.toBeNull();
  });

  it('gives Delete and Next accessible names', async () => {
    fixture.detectChanges();
    expect(key('del').getAttribute('aria-label')).toBe('login.delete');
    expect(key('ok').getAttribute('aria-label')).toBe('login.next');
  });
});
