import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workflow-prompt-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="workflow-prompt-card animate-fade-in mb-4 p-4 border-0 rounded-3 shadow-sm"
      [style.border-left]="'4px solid ' + (color || '#2a6f47') + ' !important'"
    >
      <div class="row align-items-center g-3">
        <div class="col-lg-8 col-12">
          <h5 class="fw-bold mb-2" [style.color]="color || '#2a6f47'">
            <i [class]="'bi ' + icon + ' me-2'"></i>{{ title }}
          </h5>
          <p class="text-secondary mb-0">{{ message }}</p>
        </div>
        <div class="col-lg-4 col-12 text-lg-end">
          <button
            type="button"
            [class]="'btn btn-sm ' + (buttonStyle || 'btn-success')"
            (click)="onAction()"
            class="me-2"
          >
            {{ actionLabel }}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            (click)="onDismiss()"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  `,
})
export class WorkflowPromptCardComponent {
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() actionLabel: string = 'Get Started';
  @Input() icon: string = 'bi-info-circle';
  @Input() color: string = '#2a6f47';
  @Input() buttonStyle: string = 'btn-success';

  @Output() readonly action = new EventEmitter<void>();
  @Output() readonly dismiss = new EventEmitter<void>();

  onAction(): void {
    this.action.emit();
  }

  onDismiss(): void {
    this.dismiss.emit();
  }
}
