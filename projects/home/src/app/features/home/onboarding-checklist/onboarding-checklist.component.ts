import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  done: boolean;
  /** Navigate here, or emit `action` when absent. */
  route?: string;
  actionLabel: string;
}

/** Four-step "get started" card shown until a new farmer has set up their farm. */
@Component({
  selector: 'app-onboarding-checklist',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './onboarding-checklist.component.html',
  styleUrl: './onboarding-checklist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingChecklistComponent {
  readonly steps = input.required<OnboardingStep[]>();
  readonly action = output<string>();

  readonly doneCount = computed(() => this.steps().filter((s) => s.done).length);
  readonly progress = computed(() => {
    const total = this.steps().length;
    return total ? Math.round((this.doneCount() / total) * 100) : 0;
  });
  readonly nextStep = computed(() => this.steps().find((s) => !s.done));
}
