import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalDatePipe, LocalNumberPipe } from '../../../core/i18n/localized.pipes';
import { CropSale } from './crop-sale.models';
import { SalesSummary } from './sales-summary';

/** The Sales card on a crop page: figures, one row per sale, and the actions. Presentation only. */
@Component({
  selector: 'app-crop-sales-card',
  imports: [TranslatePipe, LocalDatePipe, LocalNumberPipe],
  templateUrl: './crop-sales-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CropSalesCardComponent {
  readonly sales = input.required<CropSale[]>();
  readonly summary = input.required<SalesSummary>();
  readonly expenses = input.required<number>();

  readonly add = output<void>();
  readonly edit = output<CropSale>();
  readonly remove = output<CropSale>();

  protected readonly abs = Math.abs;

  readonly profitTone = computed(() =>
    this.summary().profit < 0 ? 'text-danger' : 'text-success',
  );
  readonly perAcreTone = computed(() =>
    (this.summary().profitPerAcre ?? 0) < 0 ? 'text-danger' : 'text-success',
  );
}
