import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CropTimelineService } from '../crop-timeline.service';
import { CropEntity, CropStage } from '../crop-timeline.models';

@Component({
  standalone: true,
  selector: 'app-crop-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './crop-dashboard.component.html',
  styleUrl: './crop-dashboard.component.scss'
})
export class CropDashboardComponent {
  private readonly timelineService = inject(CropTimelineService);

  @Input({ required: true }) filteredCrops!: CropEntity[];
  @Input({ required: true }) searchTerm!: string;

  @Output() readonly searchTermChange = new EventEmitter<string>();
  @Output() readonly cropSelected = new EventEmitter<CropEntity>();
  @Output() readonly addCropClicked = new EventEmitter<void>();

  readonly stages: CropStage[] = [
    'Land Preparation',
    'Sowing',
    'Germination',
    'Vegetative Growth',
    'Flowering',
    'Fruiting / Pod Formation',
    'Maturity',
    'Harvest'
  ];

  getDaysAfterSowing(sowingDateStr: string): number {
    const sowing = Date.parse(sowingDateStr);
    const diff = Date.now() - sowing;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days < 0 ? 0 : days;
  }

  getDaysSinceLastActivity(cropId: string): string {
    const cropActs = this.timelineService.activities()
      .filter(a => a.cropId === cropId && a.status === 'Completed')
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    
    if (cropActs.length === 0) {
      return 'No activity logged';
    }
    
    const lastDate = Date.parse(cropActs[0].date);
    const diff = Date.now() - lastDate;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return 'Today';
    if (days === 0) return 'Today';
    if (days === 1) return '1 Day';
    return `${days} Days`;
  }

  getNextStage(currentStage: CropStage): string {
    const idx = this.stages.indexOf(currentStage);
    if (idx === -1 || idx === this.stages.length - 1) {
      return 'Fully Mature';
    }
    return this.stages[idx + 1];
  }

  getStageIndex(stage: CropStage): number {
    return this.stages.indexOf(stage);
  }
}
