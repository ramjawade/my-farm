import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One step of a lifecycle: a small caption (e.g. "Stage 1") and its name. */
export interface LifecycleStep {
  caption: string;
  name: string;
}

/**
 * A horizontal lifecycle stepper: numbered circles joined by a line, steps up
 * to the current one marked done, the current one highlighted. Display only;
 * the caller supplies the (already translated) text and the current index.
 */
@Component({
  selector: 'lib-lifecycle-stepper',
  templateUrl: './lifecycle-stepper.component.html',
  styleUrl: './lifecycle-stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifecycleStepperComponent {
  readonly steps = input.required<LifecycleStep[]>();
  /** Zero-based index of the current step; -1 marks none as reached. */
  readonly currentIndex = input.required<number>();
  /** Accessible name for the whole stepper. */
  readonly label = input('');
}
