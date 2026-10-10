import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalNumberPipe } from '../../../core/i18n/localized.pipes';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';
import { CropEntity } from '../../crop-timeline/crop-timeline.models';
import { cropIconClass, daysAfterSowing } from '../../crop-timeline/crop-timeline.utils';
import { StageBarComponent } from '../../crop-timeline/stage-bar/stage-bar.component';
import { SavedFarm } from '../../../map/models/map.models';
import { dayDiff } from '../home-summary';
import { HomeFarmMapComponent } from './home-farm-map.component';

const VISIBLE_CROPS = 2;

/** A short view of the farm: its first crops with stage, harvest and cost. */
@Component({
  selector: 'app-home-farm-card',
  imports: [
    RouterLink,
    TranslatePipe,
    LocalNumberPipe,
    ReferenceNamePipe,
    StageBarComponent,
    HomeFarmMapComponent,
  ],
  template: `
    <section class="card">
      <h2 class="fs-6 fw-bold d-flex justify-content-between align-items-center mb-2">
        {{ 'homeScreen.farm.title' | translate }}
        @if (selectedLand(); as land) {
          <a
            routerLink="/map"
            [queryParams]="{ land: land.id }"
            class="fw-normal small text-decoration-none"
          >
            {{ 'homeScreen.farm.viewLand' | translate }}
            <i class="bi bi-chevron-right" aria-hidden="true"></i>
          </a>
        } @else if (lands().length) {
          <span class="fw-normal small text-body-secondary">{{
            'homeScreen.farm.tapLand' | translate
          }}</span>
        }
      </h2>

      @if (lands().length) {
        <app-home-farm-map
          [lands]="lands()"
          [selectedId]="selectedLand()?.id ?? null"
          [details]="landDetails()"
          [label]="'homeScreen.farm.mapLabel' | translate: { count: lands().length }"
          (selectLand)="selectLand.emit($event)"
        />
      }

      @if (selectedLand(); as land) {
        <div class="d-flex justify-content-between align-items-baseline mt-3 mb-1" style="gap: 8px">
          <strong>{{ land.name }}</strong>
          <span class="small d-flex align-items-baseline" style="gap: 12px">
            <span class="text-body-secondary">
              @if (crops().length) {
                {{
                  'homeScreen.farm.showing'
                    | translate: { shown: visible().length, total: crops().length }
                }}
              } @else {
                {{ 'homeScreen.farm.noCropYet' | translate }}
              }
            </span>
            @if (crops().length) {
              <a routerLink="/crops" class="text-decoration-none">
                {{ 'cropActivity.viewAll' | translate }}
                <i class="bi bi-chevron-right" aria-hidden="true"></i>
              </a>
            }
          </span>
        </div>
      }

      @for (crop of visible(); track crop.id) {
        <button
          type="button"
          class="d-flex align-items-center flex-wrap w-100 border-0 bg-transparent text-reset text-start px-0"
          style="gap: 12px; padding-block: 10px"
          [class.border-top]="!$first"
          (click)="openCrop.emit(crop)"
        >
          <span
            class="d-inline-flex align-items-center justify-content-center rounded-3 bg-success-subtle text-success flex-shrink-0"
            style="width: 32px; height: 32px"
            aria-hidden="true"
          >
            <i class="bi {{ iconClass(crop) }}"></i>
          </span>
          <span class="min-w-0" style="flex: 1 1 6rem">
            <strong class="d-block text-truncate">{{ crop.name | referenceName: 'crop' }}</strong>
            <small class="text-body-secondary">
              @if (age(crop) === null) {
                –
              } @else if (age(crop) === 0) {
                {{ 'homeScreen.farm.sownToday' | translate }}
              } @else {
                {{ 'cropDashboard.daysCount' | translate: { days: age(crop) } }}
              }
            </small>
          </span>
          <span class="order-3 order-md-0" style="flex: 1 1 100%; min-width: 0">
            <app-stage-bar [stage]="crop.currentStage" />
          </span>
          <span class="text-end flex-shrink-0">
            <strong class="d-block">
              @if (harvestDays(crop) === null) {
                –
              } @else {
                {{ 'homeScreen.tiles.inDays' | translate: { count: harvestDays(crop) } }}
              }
            </strong>
            <small class="text-body-secondary">{{ 'homeScreen.farm.toHarvest' | translate }}</small>
          </span>
          <span class="text-end flex-shrink-0">
            <strong class="d-block">₹{{ costOf(crop) | localNumber: '1.0-0' }}</strong>
            <small class="text-body-secondary">{{ 'homeScreen.farm.expenses' | translate }}</small>
          </span>
        </button>
      } @empty {
        <p class="text-body-secondary small mb-0 mt-2">
          {{ 'homeScreen.farm.nothingPlanted' | translate }} ·
          <a
            routerLink="/crops/add"
            [queryParams]="selectedLand() ? { landId: selectedLand()!.id } : null"
            class="text-decoration-none"
          >
            {{ 'cropDashboard.addCrop' | translate }}
            <i class="bi bi-chevron-right" aria-hidden="true"></i>
          </a>
        </p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeFarmCardComponent {
  readonly lands = input<SavedFarm[]>([]);
  /** The land shown below the map, or null when none is selected. */
  readonly selectedLand = input<SavedFarm | null>(null);
  /** The second map label line per land id, such as its crops. */
  readonly landDetails = input<Record<number, string>>({});
  /** The crops of the selected land (all crops when there are no lands). */
  readonly crops = input.required<CropEntity[]>();
  readonly selectLand = output<number>();
  /** Expenses logged per crop id. */
  readonly costByCrop = input<Record<number, number>>({});
  /** The time used for ages and harvest countdowns. */
  readonly now = input(Date.now());
  readonly openCrop = output<CropEntity>();

  readonly visible = computed(() => this.crops().slice(0, VISIBLE_CROPS));

  iconClass(crop: CropEntity): string {
    return cropIconClass(crop.name);
  }

  age(crop: CropEntity): number | null {
    return daysAfterSowing(crop.sowingDate);
  }

  /** Days until the expected harvest; null when unset or already past. */
  harvestDays(crop: CropEntity): number | null {
    if (!crop.expectedHarvestDate) return null;
    const days = dayDiff(crop.expectedHarvestDate, this.now());
    return days >= 0 ? days : null;
  }

  costOf(crop: CropEntity): number {
    return this.costByCrop()[crop.id] ?? 0;
  }
}
