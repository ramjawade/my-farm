import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';

export type FilterKey = 'season' | 'crop' | 'field' | 'type' | 'status' | 'sort';

export interface FilterChip {
  key: FilterKey;
  /** The filter's name, already translated. */
  label: string;
  /** The chosen option, already translated. */
  value: string;
}

export interface FilterOption {
  id: number;
  name: string;
}

/** The filter bar: a toggle with a count badge, chips while closed, the count and Clear. */
@Component({
  selector: 'app-activity-filter-bar',
  imports: [TranslatePipe, ReferenceNamePipe],
  template: `
    <section
      class="card"
      [class.border-success]="chips().length > 0"
      role="group"
      [attr.aria-label]="'activityLogScreen.filterLabel' | translate"
    >
      <div class="d-flex flex-wrap align-items-center" style="gap: 8px">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center"
          style="gap: 6px"
          [class.active]="chips().length > 0"
          [attr.aria-expanded]="open()"
          aria-controls="activity-filter-panel"
          (click)="open.set(!open())"
        >
          <i class="bi bi-funnel-fill" aria-hidden="true"></i>
          {{ 'activityLogScreen.filters' | translate }}
          @if (chips().length) {
            <span class="badge rounded-pill text-bg-success">{{ chips().length }}</span>
          }
          <i
            class="bi bi-chevron-down"
            [class.rotate-180]="open()"
            style="font-size: 0.75rem"
            aria-hidden="true"
          ></i>
        </button>

        @if (!open()) {
          @for (chip of chips(); track chip.key) {
            <span
              class="badge text-bg-light border d-inline-flex align-items-center"
              style="gap: 4px"
            >
              {{ chip.label }}: <strong>{{ chip.value }}</strong>
              <button
                type="button"
                class="btn-close"
                style="font-size: 0.5rem"
                [attr.aria-label]="
                  'activityLogScreen.removeFilter' | translate: { name: chip.label }
                "
                (click)="filterChange.emit({ key: chip.key, value: 'All' })"
              ></button>
            </span>
          }
        }

        <small class="text-body-secondary ms-auto">
          {{ 'activityLogScreen.showing' | translate: { shown: shown(), total: total() } }}
        </small>
        @if (chips().length) {
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="cleared.emit()">
            {{ 'activityLogScreen.clear' | translate }}
          </button>
        }
      </div>

      @if (open()) {
        <div id="activity-filter-panel" class="row g-2 mt-1">
          <div class="col-6 col-md-4">
            <label class="form-label small mb-1" for="af-season">{{
              'activityList.season' | translate
            }}</label>
            <select
              id="af-season"
              class="form-select"
              [value]="season()"
              (change)="pick('season', $event)"
            >
              <option value="All">{{ 'activityList.allSeasons' | translate }}</option>
              <option value="Kharif">{{ 'Kharif' | referenceName: 'season' }}</option>
              <option value="Rabi">{{ 'Rabi' | referenceName: 'season' }}</option>
              <option value="Zaid">{{ 'Zaid' | referenceName: 'season' }}</option>
            </select>
          </div>

          @if (showCrop()) {
            <div class="col-6 col-md-4">
              <label class="form-label small mb-1" for="af-crop">{{
                'activityList.linkedCrop' | translate
              }}</label>
              <select
                id="af-crop"
                class="form-select"
                [value]="crop()"
                (change)="pick('crop', $event)"
              >
                <option value="All">{{ 'activityList.allCrops' | translate }}</option>
                @for (c of crops(); track c.id) {
                  <option [value]="c.id">{{ c.name | referenceName: 'crop' }}</option>
                }
              </select>
            </div>
          }

          <div class="col-6 col-md-4">
            <label class="form-label small mb-1" for="af-field">{{
              'activityList.fieldPlot' | translate
            }}</label>
            <select
              id="af-field"
              class="form-select"
              [value]="field()"
              (change)="pick('field', $event)"
            >
              <option value="All">{{ 'activityList.allFields' | translate }}</option>
              @for (f of fields(); track f.id) {
                <option [value]="f.id">{{ f.name }}</option>
              }
            </select>
          </div>

          <div class="col-6 col-md-4">
            <label class="form-label small mb-1" for="af-type">{{
              'activityList.activityType' | translate
            }}</label>
            <select
              id="af-type"
              class="form-select"
              [value]="type()"
              (change)="pick('type', $event)"
            >
              <option value="All">{{ 'activityList.allTypes' | translate }}</option>
              @for (t of types(); track t) {
                <option [value]="t">{{ t | referenceName: 'activity' }}</option>
              }
            </select>
          </div>

          <div class="col-6 col-md-4">
            <label class="form-label small mb-1" for="af-status">{{
              'activityList.status' | translate
            }}</label>
            <select
              id="af-status"
              class="form-select"
              [value]="status()"
              (change)="pick('status', $event)"
            >
              <option value="All">{{ 'activityList.allStatuses' | translate }}</option>
              <option value="Upcoming">{{ 'activityList.statusUpcoming' | translate }}</option>
              <option value="Scheduled">{{ 'status.scheduled' | translate }}</option>
              <option value="Draft">{{ 'status.draft' | translate }}</option>
              <option value="In Progress">{{ 'status.in_progress' | translate }}</option>
              <option value="Completed">{{ 'status.completed' | translate }}</option>
              <option value="Cancelled">{{ 'status.cancelled' | translate }}</option>
            </select>
          </div>

          <div class="col-6 col-md-4">
            <label class="form-label small mb-1" for="af-sort">{{
              'activityList.sortBy' | translate
            }}</label>
            <select
              id="af-sort"
              class="form-select"
              [value]="sort()"
              (change)="pick('sort', $event)"
            >
              <option value="latest">{{ 'activityList.sortLatest' | translate }}</option>
              <option value="oldest">{{ 'activityList.sortOldest' | translate }}</option>
              <option value="cost">{{ 'activityList.sortCost' | translate }}</option>
            </select>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .rotate-180 {
      transform: rotate(180deg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityFilterBarComponent {
  readonly season = input('All');
  readonly crop = input('All');
  readonly field = input('All');
  readonly type = input('All');
  readonly status = input('All');
  readonly sort = input('latest');

  readonly crops = input<FilterOption[]>([]);
  readonly fields = input<FilterOption[]>([]);
  readonly types = input<string[]>([]);
  /** False when the list is already scoped to one crop. */
  readonly showCrop = input(true);

  /** The filters that are on, for the badge and the chips. */
  readonly chips = input<FilterChip[]>([]);
  readonly shown = input(0);
  readonly total = input(0);

  readonly filterChange = output<{ key: FilterKey; value: string }>();
  readonly cleared = output<void>();

  readonly open = signal(false);

  pick(key: FilterKey, event: Event): void {
    this.filterChange.emit({ key, value: (event.target as HTMLSelectElement).value });
  }
}
