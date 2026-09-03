import { Component, Input, Output, EventEmitter, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CropTimelineService } from '../../../features/crop-timeline/crop-timeline.service';

@Component({
  selector: 'app-land-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="land-detail-panel" *ngIf="land">
      <div class="panel-header d-flex align-items-center justify-content-between pb-3 border-bottom mb-3">
        <h5 class="m-0">{{ land.name }}</h5>
        <button
          type="button"
          class="btn btn-sm btn-link text-muted p-0"
          (click)="closed.emit()"
          aria-label="Close"
        >
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="panel-body">
        <!-- Land Area -->
        <div class="mb-3 p-2 bg-light rounded">
          <p class="text-muted small mb-1">Land Area</p>
          <p class="m-0 fw-bold">{{ land.area.hectares.toFixed(2) }} ha / {{ land.area.acres.toFixed(2) }} ac</p>
        </div>

        <!-- Crops on Land -->
        <div>
          <h6 class="fw-bold mb-2">
            <i class="bi bi-grid-3x3-gap-fill me-2 text-warning"></i>Crops on this Land
          </h6>
          @if (cropsOnLand().length > 0) {
            <div class="list-group list-group-sm">
              @for (crop of cropsOnLand(); track crop.id) {
                <a
                  [routerLink]="['/crops', crop.id]"
                  class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2"
                >
                  <div>
                    <div class="fw-medium">{{ crop.name }}</div>
                    <div class="small text-muted">{{ crop.cropType }} · Stage: {{ crop.currentStage }}</div>
                  </div>
                  <div class="text-end">
                    <div class="fw-bold text-success small">₹{{ cropCosts.get(crop.id) || 0 | number: '1.0-0' }}</div>
                    <div class="text-muted text-xxs">total cost</div>
                  </div>
                </a>
              }
            </div>
            <div class="mt-3 p-2 bg-success-subtle rounded">
              <p class="text-muted text-xxs mb-1">Total Land Cost</p>
              <p class="m-0 h6 text-success-dark fw-bold">₹{{ totalLandCost() | number: '1.0-0' }}</p>
            </div>
          } @else {
            <p class="text-muted small">No crops planted on this land yet.</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .land-detail-panel {
      max-height: 500px;
      overflow-y: auto;
    }
    .list-group-item {
      cursor: pointer;
    }
  `],
})
export class LandDetailComponent {
  @Input() land: any;
  @Output() closed = new EventEmitter<void>();

  private readonly cropService = inject(CropTimelineService);

  readonly cropCosts = new Map<string, number>();

  readonly cropsOnLand = computed(() => {
    if (!this.land) return [];
    const crops = this.cropService.cropsForField(this.land.id);
    crops.forEach((c) => {
      this.cropCosts.set(c.id, this.cropService.costForCrop(c.id));
    });
    return crops;
  });

  readonly totalLandCost = computed(() => {
    return this.cropsOnLand().reduce((sum, c) => sum + (this.cropService.costForCrop(c.id) || 0), 0);
  });
}
