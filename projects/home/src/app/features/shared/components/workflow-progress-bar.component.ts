import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { WorkflowStateService } from '../../../core/workflow/workflow-state.service';

@Component({
  selector: 'app-workflow-progress-bar',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="workflow-progress-container">
      @if (workflowService.showProgress()) {
        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-label">
              <i class="bi bi-rocket-fill me-2 text-success"></i>
              {{ 'workflowProgressBar.stepLabel' | translate: { step: currentStepNumber() } }}
            </span>
            <span class="progress-percent">{{ workflowService.progressPercent() }}%</span>
          </div>
          <div class="progress" style="height: 6px">
            <div
              class="progress-bar bg-success"
              [style.width.%]="workflowService.progressPercent()"
              role="progressbar"
            ></div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .workflow-progress-container {
        padding: 12px 0;
        background: transparent;
      }

      .progress-section {
        margin-bottom: 0;
      }

      .progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 0.85rem;
      }

      .progress-label {
        font-weight: 500;
        color: var(--mf-fg);
      }

      .progress-percent {
        color: var(--mf-leaf);
        font-weight: 600;
        font-size: 0.8rem;
      }

      .progress {
        background-color: var(--mf-leaf-soft);
        border-radius: 3px;
      }
    `,
  ],
})
export class WorkflowProgressBarComponent {
  readonly workflowService = inject(WorkflowStateService);

  readonly currentStepNumber = computed(() => {
    const completed = this.workflowService.completedPhases().length;
    return Math.min(completed + 1, 6);
  });
}
