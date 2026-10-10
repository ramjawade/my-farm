import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { LifecycleStep, LifecycleStepperComponent } from './lifecycle-stepper.component';

describe('LifecycleStepperComponent', () => {
  let fixture: ComponentFixture<LifecycleStepperComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const steps: LifecycleStep[] = [
    { caption: 'Stage 1', name: 'Sowing' },
    { caption: 'Stage 2', name: 'Growth' },
    { caption: 'Stage 3', name: 'Harvest' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(LifecycleStepperComponent);
    fixture.componentRef.setInput('steps', steps);
    fixture.componentRef.setInput('currentIndex', 1);
    fixture.detectChanges();
  });

  const items = () => Array.from(el().querySelectorAll('li'));

  it('renders one step per entry, with a line between steps only', () => {
    expect(items().length).toBe(3);
    expect(el().querySelectorAll('.step-line').length).toBe(2);
  });

  it('marks steps up to the current one done and the current one active', () => {
    expect(items().map((i) => i.classList.contains('completed'))).toEqual([true, true, false]);
    expect(items().map((i) => i.classList.contains('active'))).toEqual([false, true, false]);
    expect(items()[1].getAttribute('aria-current')).toBe('step');
    expect(items()[0].getAttribute('aria-current')).toBeNull();
  });

  it('shows a check for passed steps and the number otherwise', () => {
    expect(items()[0].querySelector('.step-circle i')).not.toBeNull();
    expect(items()[1].querySelector('.step-circle')?.textContent?.trim()).toBe('2');
    expect(items()[2].querySelector('.step-circle')?.textContent?.trim()).toBe('3');
  });

  it('colours the line up to the current step', () => {
    const lines = Array.from(el().querySelectorAll('.step-line'));
    expect(lines.map((l) => l.classList.contains('completed'))).toEqual([true, false]);
  });

  it('shows the caption and name once per step for assistive technology', () => {
    const visible = items()[0].querySelectorAll('.step-content:not([aria-hidden="true"])');
    expect(visible.length).toBe(1);
    expect(visible[0].textContent).toContain('Sowing');
  });

  it('names the stepper when a label is given', () => {
    fixture.componentRef.setInput('label', 'Crop lifecycle');
    fixture.detectChanges();
    expect(el().querySelector('ol')?.getAttribute('aria-label')).toBe('Crop lifecycle');
  });
});
