import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalDatePipe, LocalNumberPipe } from '../../../core/i18n/localized.pipes';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';
import { KeyTiles } from '../home-summary';

/** The four key numbers at the top of Home. */
@Component({
  selector: 'app-home-key-tiles',
  imports: [TranslatePipe, LocalNumberPipe, LocalDatePipe, ReferenceNamePipe],
  template: `
    <div class="row row-cols-2 row-cols-md-4" style="--bs-gutter-x: 12px; --bs-gutter-y: 12px">
      <div class="col">
        <div class="card h-100">
          <small class="text-body-secondary d-block">{{
            'homeScreen.tiles.activeCrops' | translate
          }}</small>
          <strong class="d-block kpi-value">{{ tiles().activeCrops | localNumber }}</strong>
          <small class="text-body-secondary">
            {{
              (tiles().landsCount === 1
                ? 'homeScreen.tiles.acrossLand'
                : 'homeScreen.tiles.acrossLands'
              ) | translate: { count: tiles().landsCount }
            }}
          </small>
        </div>
      </div>
      <div class="col">
        <div class="card h-100">
          <small class="text-body-secondary d-block">{{
            'homeScreen.tiles.totalArea' | translate
          }}</small>
          <strong class="d-block kpi-value">
            {{ tiles().totalAcres | localNumber: '1.0-2' }} {{ 'landEdit.acres' | translate }}
          </strong>
          <small class="text-body-secondary">{{ place() || '–' }}</small>
        </div>
      </div>
      <div class="col">
        <div class="card h-100">
          <small class="text-body-secondary d-block">{{
            'homeScreen.tiles.seasonSpend' | translate
          }}</small>
          <strong class="d-block kpi-value"
            >₹{{ tiles().seasonSpend | localNumber: '1.0-0' }}</strong
          >
          <small class="text-body-secondary">
            {{ 'homeScreen.tiles.since' | translate }}
            {{ tiles().seasonStart | localDate: 'd MMM' }}
          </small>
        </div>
      </div>
      <div class="col">
        <div class="card h-100">
          <small class="text-body-secondary d-block">{{
            'homeScreen.tiles.nextHarvest' | translate
          }}</small>
          @if (tiles().nextHarvest; as next) {
            <strong class="d-block kpi-value">
              {{ 'homeScreen.tiles.inDays' | translate: { count: next.days } }}
            </strong>
            <small class="text-body-secondary">{{ next.crop.name | referenceName: 'crop' }}</small>
          } @else {
            <strong class="d-block kpi-value">–</strong>
            <small class="text-body-secondary">{{
              'homeScreen.tiles.noHarvest' | translate
            }}</small>
          }
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeKeyTilesComponent {
  readonly tiles = input.required<KeyTiles>();
  /** The village or district shown under the area. */
  readonly place = input('');
}
