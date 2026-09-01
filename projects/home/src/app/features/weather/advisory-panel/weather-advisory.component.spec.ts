import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WeatherAdvisoryComponent } from './weather-advisory.component';

describe('WeatherAdvisoryComponent', () => {
  let component: WeatherAdvisoryComponent;
  let fixture: ComponentFixture<WeatherAdvisoryComponent>;

  const mockAdvisories = [
    'High rain expected — delay pesticide spraying',
    'Good time for irrigation (rain will reduce water need)',
    'High humidity — monitor for fungal diseases in onions',
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherAdvisoryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WeatherAdvisoryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('advisories', mockAdvisories);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display advisory panel', () => {
    const panel = fixture.nativeElement.querySelector('.advisory-panel');
    expect(panel).toBeTruthy();
  });

  it('should toggle expand/collapse', () => {
    expect(component.isExpanded()).toBeFalse();
    component.toggleExpand();
    fixture.detectChanges();
    expect(component.isExpanded()).toBeTrue();
  });

  it('should show advisory content when expanded', () => {
    component.toggleExpand();
    fixture.detectChanges();
    const content = fixture.nativeElement.querySelector('.advisory-content');
    expect(content).toBeTruthy();
  });

  it('should display all advisories when expanded', () => {
    component.toggleExpand();
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('.advisory-item');
    expect(items.length).toBe(3);
  });

  it('should return correct icon for advisory type', () => {
    const irrigationIcon = component.getAdvisoryIcon('Good time for irrigation');
    expect(irrigationIcon).toContain('droplet');

    const windIcon = component.getAdvisoryIcon('Strong winds ahead');
    expect(windIcon).toContain('wind');

    const diseaseIcon = component.getAdvisoryIcon('Monitor for disease');
    expect(diseaseIcon).toContain('exclamation');
  });

  it('should show preview when collapsed', () => {
    const preview = fixture.nativeElement.querySelector('.advisory-preview');
    expect(preview).toBeTruthy();
  });

  it('should display advisory count badge', () => {
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.textContent).toContain('3 tips');
  });

  it('should handle empty advisories', () => {
    fixture.componentRef.setInput('advisories', []);
    fixture.detectChanges();
    component.toggleExpand();
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('.advisory-empty');
    expect(empty).toBeTruthy();
  });
});
