import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Banner, BannerKind } from '../../core/banners/banner.model';

const LOOK: Record<BannerKind, { icon: string; chip: string; text: string }> = {
  problem: {
    icon: 'bi-exclamation-triangle',
    chip: 'bg-danger-subtle text-danger',
    text: 'text-danger',
  },
  warning: {
    icon: 'bi-bell',
    chip: 'bg-warning-subtle text-warning-emphasis',
    text: 'text-warning-emphasis',
  },
  update: {
    icon: 'bi-info-circle-fill',
    chip: 'bg-info-subtle text-info-emphasis',
    text: 'text-info-emphasis',
  },
  new: { icon: 'bi-star', chip: 'bg-success-subtle text-success', text: 'text-success' },
};

/** One banner card. Only a problem has a coloured border and no dismiss button. */
@Component({
  selector: 'app-banner',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="d-flex align-items-start gap-3 bg-body border rounded-3 p-3"
      [class.border-danger]="banner().kind === 'problem'"
      [attr.role]="banner().kind === 'problem' ? 'alert' : 'status'"
      [attr.data-kind]="banner().kind"
      data-testid="banner"
    >
      <span
        class="d-flex align-items-center justify-content-center flex-shrink-0 rounded-3"
        [class]="look().chip"
        style="width: 36px; height: 36px"
        aria-hidden="true"
      >
        <i class="bi" [class]="look().icon"></i>
      </span>
      <div class="flex-grow-1 min-w-0">
        <span class="d-block small fw-bold text-uppercase" [class]="look().text">{{
          label() | translate
        }}</span>
        <strong class="d-block">{{ banner().titleKey | translate: banner().params }}</strong>
        <span class="d-block small text-body-secondary">{{
          banner().textKey | translate: banner().params
        }}</span>
        @if (banner().action; as action) {
          <button
            type="button"
            class="btn btn-link btn-sm p-0 mt-1 fw-semibold text-decoration-none"
            data-testid="banner-action"
            (click)="action.run()"
          >
            {{ action.labelKey | translate }}
            <i class="bi bi-chevron-right small" aria-hidden="true"></i>
          </button>
        }
      </div>
      @if (banner().kind !== 'problem') {
        <button
          type="button"
          class="btn-close flex-shrink-0"
          data-testid="banner-dismiss"
          [attr.aria-label]="
            'banners.dismiss'
              | translate: { title: (banner().titleKey | translate: banner().params) }
          "
          (click)="dismiss.emit()"
        ></button>
      }
    </div>
  `,
})
export class BannerCard {
  readonly banner = input.required<Banner>();
  readonly dismiss = output<void>();

  protected readonly look = computed(() => LOOK[this.banner().kind]);
  protected readonly label = computed(
    () => this.banner().labelKey ?? `banners.kind.${this.banner().kind}`,
  );
}
