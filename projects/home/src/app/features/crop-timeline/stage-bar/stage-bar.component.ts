import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';
import { STAGE_STEPS, stageStep } from '../crop-timeline.utils';
import { CropStage } from '../crop-timeline.models';

/** The four-step stage bar shown on crop cards and the crop detail. */
@Component({
  selector: 'app-stage-bar',
  imports: [TranslatePipe],
  template: `
    <div role="img" [attr.aria-label]="ariaLabel()">
      <div class="d-flex gap-1" aria-hidden="true">
        @for (key of steps; track key; let i = $index) {
          <span
            class="flex-fill rounded-pill"
            style="height: 6px"
            [class.bg-success]="i <= step()"
            [class.bg-secondary-subtle]="i > step()"
            [class.opacity-50]="i < step()"
          ></span>
        }
      </div>
      <div class="d-flex justify-content-between small mt-1" aria-hidden="true">
        @for (key of steps; track key; let i = $index) {
          <span [class.fw-bold]="i === step()" [class.text-body-secondary]="i !== step()">{{
            key | translate
          }}</span>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-block' },
})
export class StageBarComponent {
  private readonly translate = inject(TranslateService);

  readonly stage = input.required<CropStage | string>();
  readonly steps = STAGE_STEPS;

  /** Which of the four steps the stored stage falls in. */
  readonly step = computed(() => stageStep(this.stage()));

  readonly ariaLabel = computed(() =>
    this.translate.instant('cropStages.ariaLabel', {
      n: this.step() + 1,
      total: STAGE_STEPS.length,
      name: this.translate.instant(STAGE_STEPS[this.step()]),
    }),
  );
}
