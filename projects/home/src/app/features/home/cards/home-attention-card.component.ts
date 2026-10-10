import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalDatePipe } from '../../../core/i18n/localized.pipes';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';
import { AttentionItem } from '../home-summary';

/** What needs attention: overdue or soon-due work and idle crops. */
@Component({
  selector: 'app-home-attention-card',
  imports: [TranslatePipe, ReferenceNamePipe, LocalDatePipe],
  template: `
    <section class="card">
      <h2 class="fs-6 fw-bold d-flex justify-content-between align-items-center mb-2">
        {{ 'homeScreen.attention.title' | translate }}
        <span
          class="badge"
          [class.text-bg-warning]="items().length"
          [class.text-bg-secondary]="!items().length"
          >{{ items().length || ('homeScreen.attention.none' | translate) }}</span
        >
      </h2>

      @for (item of items(); track $index) {
        <button
          type="button"
          class="d-flex align-items-center w-100 border-0 bg-transparent text-reset text-start px-0"
          style="gap: 12px; padding-block: 10px"
          [class.border-top]="!$first"
          (click)="open.emit(item)"
        >
          <span class="flex-grow-1 min-w-0">
            @if (item.activity; as activity) {
              <strong class="d-block text-truncate">
                {{
                  activity.customActivityName ||
                    (activity.activityTypeId | referenceName: 'activity')
                }}
              </strong>
              <small class="text-body-secondary">
                @if (activity.date) {
                  {{ activity.date | localDate: 'd MMM' }}
                }
              </small>
            } @else if (item.crop; as crop) {
              <strong class="d-block text-truncate">
                {{ 'homeScreen.attention.noActivityOn' | translate: { crop: crop.name } }}
              </strong>
              <small class="text-body-secondary">
                @if (item.lastDone) {
                  {{ 'homeScreen.attention.lastDone' | translate }}
                  {{ item.lastDone | localDate: 'd MMM' }}
                } @else {
                  {{ 'homeScreen.attention.sinceSowing' | translate }}
                }
              </small>
            }
          </span>
          <span
            class="badge"
            [class.text-bg-danger]="item.tone === 'danger'"
            [class.text-bg-warning]="item.tone === 'warning'"
            [class.text-bg-secondary]="item.tone === 'neutral'"
          >
            {{ 'homeScreen.badge.' + item.badge.kind | translate: { days: daysOf(item) } }}
          </span>
          <i class="bi bi-chevron-right text-body-secondary small" aria-hidden="true"></i>
        </button>
      } @empty {
        <div class="d-flex align-items-center" style="gap: 12px; padding-block: 10px">
          <span
            class="d-inline-flex align-items-center justify-content-center rounded-3 bg-success-subtle text-success flex-shrink-0"
            style="width: 32px; height: 32px"
            aria-hidden="true"
          >
            <i class="bi bi-check-lg"></i>
          </span>
          <span>
            <strong class="d-block">{{ 'homeScreen.attention.allClear' | translate }}</strong>
            <small class="text-body-secondary">{{
              'homeScreen.attention.allClearHint' | translate
            }}</small>
          </span>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeAttentionCardComponent {
  readonly items = input.required<AttentionItem[]>();
  readonly open = output<AttentionItem>();

  daysOf(item: AttentionItem): number {
    return 'days' in item.badge ? item.badge.days : 0;
  }
}
