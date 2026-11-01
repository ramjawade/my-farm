import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ReferenceNamePipe } from '../../core/i18n/reference-name.pipe';
import { Season, SEASONS } from '../../core/models/season';

/** Season and Year chips. Choosing one updates the bound signals at once. */
@Component({
  selector: 'app-season-filter',
  imports: [TranslatePipe, ReferenceNamePipe],
  template: `
    <div class="card p-3 d-flex flex-column gap-2">
      <div
        class="d-flex flex-wrap gap-2"
        role="radiogroup"
        [attr.aria-label]="'reports.seasonFilter' | translate"
      >
        @for (s of seasons; track s) {
          <input
            type="radio"
            class="btn-check"
            name="reports-season"
            [id]="'reports-season-' + s"
            [checked]="season() === s"
            (change)="season.set(s)"
          />
          <label class="btn btn-outline-success btn-sm" [for]="'reports-season-' + s">
            {{ s | referenceName: 'season' }}
          </label>
        }
      </div>
      <div
        class="d-flex flex-wrap gap-2"
        role="radiogroup"
        [attr.aria-label]="'reports.yearFilter' | translate"
      >
        @for (y of years(); track y) {
          <input
            type="radio"
            class="btn-check"
            name="reports-year"
            [id]="'reports-year-' + y"
            [checked]="year() === y"
            (change)="year.set(y)"
          />
          <label class="btn btn-outline-success btn-sm" [for]="'reports-year-' + y">{{ y }}</label>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonFilterComponent {
  readonly season = model.required<Season>();
  readonly year = model.required<number>();
  readonly years = input.required<number[]>();

  protected readonly seasons = SEASONS;
}
