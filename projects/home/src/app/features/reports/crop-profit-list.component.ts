import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalNumberPipe } from '../../core/i18n/localized.pipes';
import { ReferenceNamePipe } from '../../core/i18n/reference-name.pipe';
import { CropProfit } from './report.service';

/** One row per crop with sales, expenses and profit per acre; selecting a row opens the crop. */
@Component({
  selector: 'app-crop-profit-list',
  imports: [TranslatePipe, LocalNumberPipe, ReferenceNamePipe],
  template: `
    <section class="card p-3 h-100">
      <h2 class="h6">{{ 'reports.profitByCrop' | translate }}</h2>
      <ul class="list-unstyled mb-0">
        @for (crop of crops(); track crop.cropId) {
          <li class="border-top">
            <button
              type="button"
              class="btn w-100 text-start d-flex align-items-center gap-2 px-0 py-2"
              (click)="open.emit(crop.cropId)"
            >
              <span class="flex-grow-1 min-w-0">
                <strong class="d-block text-truncate">{{
                  crop.cropName | referenceName: 'crop'
                }}</strong>
                <small class="text-body-secondary">
                  {{
                    'reports.salesLine'
                      | translate
                        : {
                            sales: (crop.sales | localNumber: '1.0-0'),
                            expenses: (crop.expenses | localNumber: '1.0-0'),
                          }
                  }}
                </small>
              </span>
              <span class="text-end flex-shrink-0">
                @if (crop.soldCount > 0 && crop.profitPerAcre !== null) {
                  <strong
                    class="d-block"
                    [class.text-danger]="crop.profitPerAcre < 0"
                    [class.text-success]="crop.profitPerAcre >= 0"
                  >
                    {{ crop.profitPerAcre < 0 ? '−' : '+' }}₹{{
                      abs(crop.profitPerAcre) | localNumber: '1.0-0'
                    }}
                  </strong>
                  <small class="text-body-secondary">{{
                    'reports.profitPerAcre' | translate
                  }}</small>
                } @else if (crop.soldCount > 0) {
                  <strong class="d-block">–</strong>
                  <small class="text-body-secondary">{{
                    'reports.profitPerAcre' | translate
                  }}</small>
                } @else {
                  <strong class="d-block">–</strong>
                  <small class="text-body-secondary">{{ 'reports.noSalesYet' | translate }}</small>
                }
              </span>
              <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
            </button>
          </li>
        }
      </ul>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CropProfitListComponent {
  readonly crops = input.required<CropProfit[]>();
  readonly open = output<number>();

  protected readonly abs = Math.abs;
}
