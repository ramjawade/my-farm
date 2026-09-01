import { Component, computed, signal, input } from '@angular/core';
import { WeatherAlert } from '../../../core/weather/weather.models';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-weather-alert',
  standalone: true,
  imports: [NgClass],
  template: `
    <div *ngIf="showAlerts()" class="alert-banner">
      <div class="alert-container">
        <div *ngFor="let alert of alerts()" [ngClass]="getSeverityClass(alert.severity)" class="alert-item">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <div class="alert-content">
            <h6 class="alert-title">{{ alert.title }}</h6>
            <p class="alert-desc">{{ alert.description }}</p>
          </div>
          <button class="btn-dismiss" (click)="dismissAlert(alert)">×</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .alert-banner {
      background: linear-gradient(135deg, rgba(220, 53, 69, 0.1) 0%, rgba(255, 193, 7, 0.1) 100%);
      border-top: 3px solid #dc3545;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .alert-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .alert-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 12px;
      border-left: 3px solid;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.5);
    }
    .alert-item.high {
      border-left-color: #dc3545;
      background: rgba(220, 53, 69, 0.08);
    }
    .alert-item.medium {
      border-left-color: #ffc107;
      background: rgba(255, 193, 7, 0.08);
    }
    .alert-item.low {
      border-left-color: #0dcaf0;
      background: rgba(13, 202, 240, 0.08);
    }
    .alert-item i {
      font-size: 18px;
      margin-top: 2px;
      flex-shrink: 0;
    }
    .alert-item.high i { color: #dc3545; }
    .alert-item.medium i { color: #ffc107; }
    .alert-item.low i { color: #0dcaf0; }
    .alert-content {
      flex: 1;
      min-width: 0;
    }
    .alert-title {
      margin: 0 0 2px 0;
      font-size: 14px;
      font-weight: 600;
      color: #212529;
    }
    .alert-desc {
      margin: 0;
      font-size: 13px;
      color: #6c757d;
      line-height: 1.4;
    }
    .btn-dismiss {
      background: none;
      border: none;
      font-size: 20px;
      color: #6c757d;
      cursor: pointer;
      padding: 0;
      margin-left: 8px;
      flex-shrink: 0;
    }
    .btn-dismiss:hover {
      color: #212529;
    }
  `],
})
export class WeatherAlertComponent {
  readonly alerts = input<WeatherAlert[]>([]);
  private readonly dismissedAlerts = signal<string[]>([]);

  readonly showAlerts = computed(() => {
    const all = this.alerts();
    const dismissed = this.dismissedAlerts();
    return all.some((a) => !dismissed.includes(`${a.title}${a.effectiveAt}`));
  });

  private readonly visibleAlerts = computed(() => {
    const all = this.alerts();
    const dismissed = this.dismissedAlerts();
    return all.filter((a) => !dismissed.includes(`${a.title}${a.effectiveAt}`));
  });

  getSeverityClass(severity: string): string {
    return severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low';
  }

  dismissAlert(alert: WeatherAlert): void {
    const key = `${alert.title}${alert.effectiveAt}`;
    this.dismissedAlerts.update((prev) => [...prev, key]);
  }
}
