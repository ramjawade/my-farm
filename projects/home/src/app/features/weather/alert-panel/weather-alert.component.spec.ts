import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WeatherAlertComponent } from './weather-alert.component';
import { WeatherAlert } from '../../../core/weather/weather.models';

describe('WeatherAlertComponent', () => {
  let component: WeatherAlertComponent;
  let fixture: ComponentFixture<WeatherAlertComponent>;

  const mockAlerts: WeatherAlert[] = [
    {
      type: 'heavy_rain',
      severity: 'high',
      title: 'Heavy Rain Warning',
      description: 'Heavy rainfall expected in next 24 hours',
      effectiveAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    },
    {
      type: 'strong_wind',
      severity: 'medium',
      title: 'Strong Wind Warning',
      description: 'Wind speeds may reach 40 km/h',
      effectiveAt: Date.now(),
      expiresAt: Date.now() + 43200000,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherAlertComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WeatherAlertComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('alerts', mockAlerts);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display alerts when provided', () => {
    expect(component.showAlerts()).toBeTrue();
    const alertElements = fixture.nativeElement.querySelectorAll('.alert-item');
    expect(alertElements.length).toBe(2);
  });

  it('should display alert title and description', () => {
    const titleElement = fixture.nativeElement.querySelector('.alert-title');
    expect(titleElement.textContent).toContain('Heavy Rain Warning');
  });

  it('should apply correct severity class', () => {
    const highAlertClass = component.getSeverityClass('high');
    expect(highAlertClass).toBe('high');

    const mediumAlertClass = component.getSeverityClass('medium');
    expect(mediumAlertClass).toBe('medium');

    const lowAlertClass = component.getSeverityClass('low');
    expect(lowAlertClass).toBe('low');
  });

  it('should dismiss alert on button click', () => {
    const dismissButton = fixture.nativeElement.querySelector('.btn-dismiss');
    dismissButton.click();
    fixture.detectChanges();

    expect(component.showAlerts()).toBeTrue();
  });

  it('should not show alerts when array is empty', () => {
    fixture.componentRef.setInput('alerts', []);
    fixture.detectChanges();
    expect(component.showAlerts()).toBeFalse();
  });
});
