import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { LocalNumberPipe } from '../../../core/i18n/localized.pipes';
import { calculateFarmArea } from '../../farm-draw/farm-area.utils';
import { FarmDrawService } from '../../farm-draw/farm-draw.service';

/**
 * The drawing controls over the map: a hint at the top with the point count and
 * live area, and Undo / Finish / Cancel at the bottom. Shown only while drawing;
 * drawing starts from the page's "Draw land" button.
 */
@Component({
  selector: 'app-map-my-farm',
  imports: [TranslatePipe, LocalNumberPipe],
  templateUrl: './map-my-farm.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapMyFarmComponent {
  readonly draw = inject(FarmDrawService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly setSatelliteLayer = output<void>();
  readonly locateMeRequest = output<void>();
  readonly geolocating = signal(false);

  /** Acres of the boundary drawn so far, once it has three points. */
  readonly liveAcres = computed(() => {
    const points = this.draw.points();
    return points.length > 2 ? (calculateFarmArea(points)?.acres ?? null) : null;
  });

  constructor() {
    effect(() => {
      if (this.draw.isDrawing()) {
        this.setSatelliteLayer.emit();
      }
    });
  }

  undo(): void {
    this.draw.undoLastPoint();
  }

  finish(): void {
    this.draw.finishDrawing();
  }

  cancel(): void {
    this.draw.cancelDrawing();
  }

  locateMe(): void {
    if (!navigator.geolocation) {
      this.toast.warning(this.translate.instant('mapMyFarm.geolocationUnsupported'));
      return;
    }

    this.geolocating.set(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        this.locateMeRequest.emit();
        this.geolocating.set(false);
      },
      (error) => {
        this.geolocating.set(false);
        const message =
          error.code === 1
            ? this.translate.instant('mapMyFarm.enableLocation')
            : this.translate.instant('mapMyFarm.locationUnavailable');
        this.toast.warning(message);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }
}
