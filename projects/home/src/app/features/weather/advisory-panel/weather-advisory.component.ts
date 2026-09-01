import { Component, computed, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-weather-advisory',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="advisory-panel">
      <div class="advisory-header">
        <h5 class="advisory-title">
          <i class="bi bi-lightbulb-fill"></i>
          Farming Recommendations
        </h5>
        <button class="btn-expand" (click)="toggleExpand()">
          <i [ngClass]="isExpanded() ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </button>
      </div>

      <div *ngIf="isExpanded()" class="advisory-content">
        <div *ngIf="advisories().length === 0" class="advisory-empty">
          <p>No specific recommendations at this time.</p>
        </div>

        <div *ngFor="let advisory of advisories(); let i = index" class="advisory-item">
          <i [ngClass]="getAdvisoryIcon(advisory)"></i>
          <p>{{ advisory }}</p>
        </div>
      </div>

      <div *ngIf="!isExpanded() && advisories().length > 0" class="advisory-preview">
        <p class="preview-text">{{ advisories()[0] }}</p>
        <span class="badge bg-info">{{ advisories().length }} tips</span>
      </div>
    </div>
  `,
  styles: [`
    .advisory-panel {
      background: linear-gradient(135deg, rgba(13, 202, 240, 0.08) 0%, rgba(25, 135, 84, 0.08) 100%);
      border: 1px solid rgba(13, 202, 240, 0.2);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .advisory-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .advisory-title {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #212529;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .advisory-title i {
      color: #ffc107;
      font-size: 16px;
    }
    .btn-expand {
      background: none;
      border: none;
      color: #6c757d;
      cursor: pointer;
      padding: 0;
      font-size: 18px;
    }
    .btn-expand:hover {
      color: #212529;
    }
    .advisory-content {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .advisory-item {
      display: flex;
      gap: 10px;
      font-size: 13px;
      line-height: 1.5;
      align-items: flex-start;
      color: #495057;
    }
    .advisory-item i {
      flex-shrink: 0;
      font-size: 14px;
      margin-top: 2px;
    }
    .advisory-item p {
      margin: 0;
    }
    .advisory-empty {
      padding: 8px 0;
      text-align: center;
      color: #6c757d;
      font-size: 13px;
    }
    .advisory-preview {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(13, 202, 240, 0.1);
    }
    .preview-text {
      margin: 0;
      font-size: 13px;
      color: #495057;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .badge {
      font-size: 11px;
      padding: 3px 6px;
      white-space: nowrap;
      flex-shrink: 0;
    }
  `],
})
export class WeatherAdvisoryComponent {
  readonly advisories = input<string[]>([]);
  readonly isExpanded = signal(false);

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
  }

  getAdvisoryIcon(advisory: string): string {
    if (advisory.toLowerCase().includes('irrigation') || advisory.toLowerCase().includes('rain')) {
      return 'bi bi-droplet-fill text-primary';
    }
    if (advisory.toLowerCase().includes('spray') || advisory.toLowerCase().includes('disease')) {
      return 'bi bi-exclamation-circle-fill text-warning';
    }
    if (advisory.toLowerCase().includes('wind') || advisory.toLowerCase().includes('secure')) {
      return 'bi bi-wind text-info';
    }
    if (advisory.toLowerCase().includes('temperature') || advisory.toLowerCase().includes('moisture')) {
      return 'bi bi-thermometer-half text-danger';
    }
    return 'bi bi-check-circle-fill text-success';
  }
}
