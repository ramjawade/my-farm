import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CropTimelineService } from '../crop-timeline.service';
import { CropTimelineComponent } from '../crop-timeline.component';
import { CropEntity, CropStage } from '../crop-timeline.models';

@Component({
  standalone: true,
  selector: 'app-crop-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './crop-dashboard.component.html',
  styleUrl: './crop-dashboard.component.scss'
})
export class CropDashboardComponent implements OnInit {
  private readonly timelineService = inject(CropTimelineService);
  private readonly parent = inject(CropTimelineComponent, { optional: true });
  private readonly router = inject(Router, { optional: true });

  private _filteredCrops?: CropEntity[];
  @Input() set filteredCrops(value: CropEntity[]) {
    this._filteredCrops = value;
  }
  get filteredCrops(): CropEntity[] {
    return this._filteredCrops || this.parent?.filteredCrops() || [];
  }

  private _searchTerm?: string;
  @Input() set searchTerm(value: string) {
    this._searchTerm = value;
  }
  get searchTerm(): string {
    return this._searchTerm !== undefined ? this._searchTerm : this.parent?.searchTerm() || '';
  }

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

  ngOnInit(): void {
    if (this.parent) {
      this.parent.selectedCrop.set(null);
      this.parent.currentView.set('dashboard');
    }
  }

  onSearchTermChange(value: string): void {
    this.searchTermChange.emit(value);
    if (this.parent) {
      this.parent.searchTerm.set(value);
    }
  }

  onCropSelected(crop: CropEntity): void {
    this.cropSelected.emit(crop);
    if (this.router) {
      this.router.navigate(['/crops', crop.id]);
    }
  }

  onAddCropClicked(): void {
    this.addCropClicked.emit();
    if (this.router) {
      this.router.navigate(['/crops/add']);
    }
  }

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
