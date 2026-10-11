import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalDatePipe, LocalNumberPipe } from '../../../core/i18n/localized.pipes';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';
import { Activity } from '../../activity/activity.models';
import { activityStatusKey, activityStatusTone } from '../../activity/activity-status';

/** One activity as a compact row; selecting it asks the page to open the activity. */
@Component({
  selector: 'app-activity-row',
  imports: [TranslatePipe, LocalDatePipe, LocalNumberPipe, ReferenceNamePipe],
  template: `
    <button
      type="button"
      class="d-flex align-items-center w-100 border-0 bg-transparent text-reset text-start px-0"
      style="gap: 12px; padding-block: 10px"
      (click)="open.emit(activity())"
    >
      <span
        class="d-inline-flex flex-column align-items-center justify-content-center rounded-3 bg-success-subtle text-success flex-shrink-0 lh-1"
        style="width: 44px; height: 44px; gap: 2px"
        aria-hidden="true"
      >
        @if (activity().date) {
          <strong>{{ activity().date | localDate: 'dd' }}</strong>
          <small>{{ activity().date | localDate: 'MMM' }}</small>
        } @else {
          –
        }
      </span>
      <span class="flex-grow-1 min-w-0">
        <strong
          class="d-block text-truncate"
          [class.text-decoration-line-through]="cancelled()"
          [class.text-body-secondary]="cancelled()"
        >
          {{ activity().activityTypeId | referenceName: 'activity' }}
        </strong>
        <small class="d-block text-truncate text-body-secondary">
          @if (fieldName()) {
            {{ fieldName() }} ·
          }
          @if (cropName()) {
            {{ cropName() | referenceName: 'crop' }} ·
          }
          {{ statusKey() | translate }}
        </small>
      </span>
      @if (showBadge()) {
        <span class="badge flex-shrink-0 text-bg-{{ tone() }}">{{ statusKey() | translate }}</span>
      } @else {
        <strong class="flex-shrink-0">
          @if (total() > 0) {
            ₹{{ total() | localNumber }}
          } @else {
            –
          }
        </strong>
      }
      <i class="bi bi-chevron-right text-body-secondary flex-shrink-0" aria-hidden="true"></i>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityRowComponent {
  readonly activity = input.required<Activity>();
  readonly fieldName = input('');
  readonly cropName = input('');
  /** The activity's total expense. */
  readonly total = input(0);
  readonly open = output<Activity>();

  readonly statusKey = computed(() => activityStatusKey(this.activity().status));
  readonly tone = computed(() => activityStatusTone(this.activity().status));
  readonly cancelled = computed(() => this.activity().status === 'Cancelled');
  /** Open activities show their status at the end; finished ones show what they cost. */
  readonly showBadge = computed(() => {
    const status = this.activity().status;
    return status !== 'Completed' && status !== 'Cancelled';
  });
}
