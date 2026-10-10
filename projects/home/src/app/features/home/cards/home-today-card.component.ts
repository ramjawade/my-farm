import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';
import { CropEntity } from '../../crop-timeline/crop-timeline.models';
import { TodayItem } from '../home-summary';

/** Today's planned work, with a checkbox to mark each activity done. */
@Component({
  selector: 'app-home-today-card',
  imports: [TranslatePipe, ReferenceNamePipe],
  template: `
    <section class="card">
      <h2 class="fs-6 fw-bold d-flex justify-content-between align-items-center mb-2">
        {{ 'homeScreen.today.title' | translate }}
        <span class="fw-normal small text-body-secondary">
          {{ 'homeScreen.today.doneOf' | translate: { done: doneCount(), total: items().length } }}
        </span>
      </h2>

      @if (items().length) {
        <div
          class="progress mb-1"
          role="progressbar"
          style="height: 6px"
          [attr.aria-valuenow]="percent()"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-label]="'homeScreen.today.title' | translate"
        >
          <div class="progress-bar bg-success" [style.width.%]="percent()"></div>
        </div>
        @for (item of items(); track item.activity.id) {
          <label
            class="d-flex align-items-center"
            style="gap: 12px; padding-block: 10px"
            [class.border-top]="!$first"
          >
            <input
              type="checkbox"
              class="form-check-input mt-0 flex-shrink-0"
              style="width: 1.25rem; height: 1.25rem"
              [checked]="item.done"
              [disabled]="item.done"
              [attr.aria-label]="
                'homeScreen.today.markDone'
                  | translate
                    : {
                        name:
                          item.activity.customActivityName ||
                          (item.activity.activityTypeId | referenceName: 'activity'),
                      }
              "
              (change)="complete.emit(item)"
            />
            <span class="flex-grow-1 min-w-0">
              <strong
                class="d-block text-truncate"
                [class.text-decoration-line-through]="item.done"
                [class.text-body-secondary]="item.done"
              >
                {{
                  item.activity.customActivityName ||
                    (item.activity.activityTypeId | referenceName: 'activity')
                }}
              </strong>
              @if (cropOf(item); as crop) {
                <small class="text-body-secondary">{{ crop.name | referenceName: 'crop' }}</small>
              }
            </span>
          </label>
        }
      } @else {
        <p class="text-body-secondary small mb-0">{{ 'homeScreen.today.nothing' | translate }}</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeTodayCardComponent {
  readonly items = input.required<TodayItem[]>();
  readonly crops = input<CropEntity[]>([]);
  readonly complete = output<TodayItem>();

  readonly doneCount = computed(() => this.items().filter((i) => i.done).length);
  readonly percent = computed(() =>
    this.items().length ? Math.round((this.doneCount() / this.items().length) * 100) : 0,
  );

  cropOf(item: TodayItem): CropEntity | undefined {
    return this.crops().find((c) => c.id === item.activity.cropId);
  }
}
