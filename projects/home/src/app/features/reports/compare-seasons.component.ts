import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalNumberPipe } from '../../core/i18n/localized.pipes';
import { ReferenceNamePipe } from '../../core/i18n/reference-name.pipe';
import { CompareRow } from './report.service';

/** Pick a crop name and see each sowing of it side by side. It is not affected by the season filter. */
@Component({
  selector: 'app-compare-seasons',
  imports: [TranslatePipe, LocalNumberPipe, ReferenceNamePipe],
  template: `
    <section class="card p-3 h-100" data-testid="compare-seasons">
      <h2 class="h6 d-flex justify-content-between align-items-baseline">
        {{ 'reports.compareSeasons' | translate }}
        <small class="text-body-secondary fw-normal">{{ 'reports.notFiltered' | translate }}</small>
      </h2>
      @if (names().length) {
        <div
          class="d-flex flex-wrap gap-2 mb-2"
          role="radiogroup"
          [attr.aria-label]="'reports.cropToCompare' | translate"
        >
          @for (name of names(); track name) {
            <input
              type="radio"
              class="btn-check"
              name="reports-compare"
              [id]="'reports-compare-' + name"
              [checked]="selected() === name"
              (change)="choose.emit(name)"
            />
            <label class="btn btn-outline-success btn-sm" [for]="'reports-compare-' + name">
              {{ name | referenceName: 'crop' }}
            </label>
          }
        </div>
        @for (row of rows(); track row.cropId) {
          <div class="border-top py-2">
            <div class="d-flex justify-content-between align-items-baseline gap-3">
              <div class="min-w-0">
                <strong>
                  @if (row.season) {
                    {{ row.season | referenceName: 'season' }}
                  }
                  {{ row.year }}
                </strong>
                @if (row.inProgress) {
                  <span class="badge text-bg-warning ms-1">{{
                    'reports.inProgress' | translate
                  }}</span>
                }
                <small class="d-block text-body-secondary">
                  {{ areaKey(row) | translate: { value: row.areaLabel.area } }} ·
                  {{
                    'reports.salesLine'
                      | translate
                        : {
                            sales: (row.sales | localNumber: '1.0-0'),
                            expenses: (row.expenses | localNumber: '1.0-0'),
                          }
                  }}
                </small>
              </div>
              <div class="text-end flex-shrink-0">
                @if (row.sold && row.profitPerAcre !== null) {
                  <strong
                    class="d-block"
                    [class.text-danger]="row.profitPerAcre < 0"
                    [class.text-success]="row.profitPerAcre >= 0"
                  >
                    {{ row.profitPerAcre < 0 ? '−' : '+' }}₹{{
                      abs(row.profitPerAcre) | localNumber: '1.0-0'
                    }}
                  </strong>
                  <small class="text-body-secondary">{{ 'reports.perAcre' | translate }}</small>
                } @else {
                  <strong class="d-block">–</strong>
                  <small class="text-body-secondary">{{
                    (row.sold ? 'reports.perAcre' : 'reports.noSalesYet') | translate
                  }}</small>
                }
              </div>
            </div>
            @if (row.sold && row.profitPerAcre !== null) {
              <div class="progress mt-2" style="height: 8px" aria-hidden="true">
                <div
                  class="progress-bar"
                  [class.bg-danger]="row.profitPerAcre < 0"
                  [class.bg-success]="row.profitPerAcre >= 0"
                  [style.width.%]="barWidth(row.profitPerAcre)"
                ></div>
              </div>
            }
          </div>
        }
      } @else {
        <p class="text-body-secondary mb-0">{{ 'reports.noComparison' | translate }}</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareSeasonsComponent {
  readonly names = input.required<string[]>();
  readonly selected = input.required<string>();
  readonly rows = input.required<CompareRow[]>();
  readonly choose = output<string>();

  protected readonly abs = Math.abs;

  /** The largest profit per acre among the rows, which gets a full-width bar. */
  private readonly maxPerAcre = computed(() =>
    Math.max(1, ...this.rows().map((r) => (r.sold ? Math.abs(r.profitPerAcre ?? 0) : 0))),
  );

  protected barWidth(profitPerAcre: number): number {
    return Math.max(4, Math.round((Math.abs(profitPerAcre) / this.maxPerAcre()) * 100));
  }

  protected areaKey(row: CompareRow): string {
    return row.areaLabel.unit === 'hectares' ? 'reports.areaHectares' : 'reports.areaAcres';
  }
}
