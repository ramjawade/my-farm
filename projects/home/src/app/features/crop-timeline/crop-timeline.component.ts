import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { CropTimelineService } from './crop-timeline.service';
import { CropEntity, ActivityEntity, CropStage, ActivityType, ActivityStatus } from './crop-timeline.models';

import { CropDashboardComponent } from './dashboard/crop-dashboard.component';
import { AddCropComponent } from './add-crop/add-crop.component';
import { CropTimelineDetailComponent } from './detail/crop-timeline-detail.component';

@Component({
  standalone: true,
  selector: 'app-crop-timeline',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CropDashboardComponent,
    AddCropComponent,
    CropTimelineDetailComponent
  ],
  templateUrl: './crop-timeline.component.html',
  styleUrl: './crop-timeline.component.scss'
})
export class CropTimelineComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly timelineService = inject(CropTimelineService);

  // View state signals
  readonly currentView = signal<'dashboard' | 'timeline' | 'add-crop'>('dashboard');
  readonly selectedCrop = signal<CropEntity | null>(null);
  readonly searchTerm = signal<string>('');
  readonly showActivityModal = signal<boolean>(false);
  readonly editingActivity = signal<ActivityEntity | null>(null);

  // File Upload previews signal
  readonly uploadedImages = signal<string[]>([]);

  // Constant arrays
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

  readonly activityTypes: { type: ActivityType; icon: string; color: string }[] = [
    { type: 'Sowing', icon: 'bi-seedling', color: '#38a169' },
    { type: 'Irrigation', icon: 'bi-droplet-half', color: '#3182ce' },
    { type: 'Fertilizer Application', icon: 'bi-box-seam', color: '#805ad5' },
    { type: 'Spray Application', icon: 'bi-wind', color: '#e53e3e' },
    { type: 'Weeding', icon: 'bi-scissors', color: '#dd6b20' },
    { type: 'Field Inspection', icon: 'bi-eye-fill', color: '#319795' },
    { type: 'Labour Activity', icon: 'bi-people-fill', color: '#4a5568' },
    { type: 'Harvest', icon: 'bi-flower3', color: '#d69e2e' },
    { type: 'Sale', icon: 'bi-cash-coin', color: '#38a169' },
    { type: 'Weather Incident', icon: 'bi-lightning-charge-fill', color: '#e53e3e' }
  ];

  readonly activityStatuses: ActivityStatus[] = ['Planned', 'Scheduled', 'Completed', 'Cancelled'];

  readonly cropNameOptions = ['Soybeans', 'Wheat', 'Rice', 'Corn', 'Cotton', 'Sugarcane', 'Mustard', 'Vegetables', 'Fruits'];

  // Form Groups
  cropForm: FormGroup;
  activityForm: FormGroup;

  // Search filter computed crops list
  readonly filteredCrops = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const allCrops = this.timelineService.crops();
    if (!term) return allCrops;
    return allCrops.filter(
      c => c.name.toLowerCase().includes(term) || c.fieldId.toLowerCase().includes(term)
    );
  });

  // Timeline activities computed for selected crop sorted chronologically
  readonly cropActivities = computed(() => {
    const activeCrop = this.selectedCrop();
    if (!activeCrop) return [];
    
    // Sort completed/cancelled/past status chronologically descending (latest first)
    // Sort planned/scheduled upcoming tasks chronologically ascending (earliest first)
    const all = this.timelineService.activities().filter(a => a.cropId === activeCrop.id);
    
    const completedHistory = all
      .filter(a => a.status === 'Completed' || a.status === 'Cancelled')
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

    return completedHistory;
  });

  // Upcoming planned/scheduled tasks computed for selected crop
  readonly upcomingActivities = computed(() => {
    const activeCrop = this.selectedCrop();
    if (!activeCrop) return [];
    
    return this.timelineService.activities()
      .filter(a => a.cropId === activeCrop.id && (a.status === 'Planned' || a.status === 'Scheduled'))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  });

  constructor() {
    // Form setups
    this.cropForm = this.fb.group({
      name: ['Soybeans', Validators.required],
      fieldId: ['', [Validators.required, Validators.minLength(2)]],
      area: ['', [Validators.required, Validators.min(0.01)]],
      areaUnit: ['hectares', Validators.required],
      sowingDate: [new Date().toISOString().substring(0, 10), Validators.required],
      currentStage: ['Land Preparation', Validators.required]
    });

    this.activityForm = this.fb.group({
      type: ['Irrigation', Validators.required],
      date: [new Date().toISOString().substring(0, 10), Validators.required],
      status: ['Completed', Validators.required],
      cost: [0, [Validators.required, Validators.min(0)]],
      notes: [''],

      // Irrigation Metadata
      irrigationMethod: ['Drip'],
      duration: [30],
      waterQuantity: [1000],

      // Fertilizer Metadata
      fertilizerName: ['NPK 19-19-19'],
      fertilizerQuantity: [25],
      applicationMethod: ['Broadcasting'],

      // Spray Metadata
      chemicalName: ['Neem Oil'],
      dosage: ['500 ml/ha'],
      sprayWaterQuantity: [200],
      targetPest: ['Aphids'],

      // Harvest Metadata
      yieldQuantity: [500],
      yieldUnit: ['kg'],
      grade: ['A'],
      sellingPrice: [40]
    });

    // Handle selected crop dynamic update inside timeline view to keep object fresh
    effect(() => {
      const active = this.selectedCrop();
      if (active) {
        const cropsList = this.timelineService.crops();
        const fresh = cropsList.find(c => c.id === active.id);
        if (fresh && fresh !== active) {
          this.selectedCrop.set(fresh);
        }
      }
    });
  }

  // --- View Helpers ---
  selectCrop(crop: CropEntity): void {
    this.selectedCrop.set(crop);
    this.currentView.set('timeline');
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

  getStageCompletionPercentage(stage: CropStage): number {
    const idx = this.stages.indexOf(stage);
    return Math.round(((idx + 1) / this.stages.length) * 100);
  }

  // --- Growth Stage Operations ---
  updateStage(stage: CropStage): void {
    const crop = this.selectedCrop();
    if (!crop) return;

    this.timelineService.updateCrop(crop.id, { currentStage: stage });
    
    // Synchronously sync selectedCrop to keep state instant in tests and UI
    const fresh = this.timelineService.crops().find(c => c.id === crop.id);
    if (fresh) {
      this.selectedCrop.set(fresh);
    }
    
    // Auto-record a "Field Inspection" activity to mark the growth stage transition
    this.timelineService.addActivity({
      cropId: crop.id,
      type: 'Field Inspection',
      date: new Date().toISOString(),
      status: 'Completed',
      cost: 0,
      notes: `Growth stage advanced to: ${stage}.`,
      attachments: [],
      metadata: {}
    });
  }

  // --- Add Crop Operations ---
  onSubmitCrop(): void {
    if (this.cropForm.invalid) return;

    const values = this.cropForm.value;
    const newCrop = this.timelineService.addCrop({
      name: values.name,
      fieldId: values.fieldId,
      area: Number(values.area),
      areaUnit: values.areaUnit,
      sowingDate: new Date(values.sowingDate).toISOString(),
      currentStage: values.currentStage as CropStage,
      status: 'Active'
    });

    // Record automatic Sowing activity if currentStage is Sowing or later
    if (this.stages.indexOf(values.currentStage) >= 1) {
      this.timelineService.addActivity({
        cropId: newCrop.id,
        type: 'Sowing',
        date: new Date(values.sowingDate).toISOString(),
        status: 'Completed',
        cost: 0,
        notes: `Initial sowing recorded in system database.`,
        attachments: [],
        metadata: {}
      });
    }

    this.cropForm.reset({
      name: 'Soybeans',
      fieldId: '',
      area: '',
      areaUnit: 'hectares',
      sowingDate: new Date().toISOString().substring(0, 10),
      currentStage: 'Land Preparation'
    });

    this.currentView.set('dashboard');
  }

  // --- Activity Actions ---
  openAddActivityModal(): void {
    this.editingActivity.set(null);
    this.uploadedImages.set([]);
    this.activityForm.reset({
      type: 'Irrigation',
      date: new Date().toISOString().substring(0, 10),
      status: 'Completed',
      cost: 0,
      notes: '',
      irrigationMethod: 'Drip',
      duration: 30,
      waterQuantity: 1000,
      fertilizerName: 'NPK 19-19-19',
      fertilizerQuantity: 25,
      applicationMethod: 'Broadcasting',
      chemicalName: 'Neem Oil',
      dosage: '500 ml/ha',
      sprayWaterQuantity: 200,
      targetPest: 'Aphids',
      yieldQuantity: 500,
      yieldUnit: 'kg',
      grade: 'A',
      sellingPrice: 40
    });
    this.showActivityModal.set(true);
  }

  openEditActivityModal(act: ActivityEntity): void {
    this.editingActivity.set(act);
    this.uploadedImages.set(act.attachments || []);
    
    this.activityForm.patchValue({
      type: act.type,
      date: act.date.substring(0, 10),
      status: act.status,
      cost: act.cost,
      notes: act.notes,
      
      // Irrigation
      irrigationMethod: act.metadata.irrigationMethod || 'Drip',
      duration: act.metadata.duration || 30,
      waterQuantity: act.metadata.waterQuantity || 1000,
      
      // Fertilizer
      fertilizerName: act.metadata.fertilizerName || 'NPK 19-19-19',
      fertilizerQuantity: act.metadata.quantity || 25,
      applicationMethod: act.metadata.applicationMethod || 'Broadcasting',
      
      // Spray
      chemicalName: act.metadata.chemicalName || 'Neem Oil',
      dosage: act.metadata.dosage || '500 ml/ha',
      sprayWaterQuantity: act.metadata.waterQuantity || 200,
      targetPest: act.metadata.targetPest || 'Aphids',
      
      // Harvest
      yieldQuantity: act.metadata.yieldQuantity || 500,
      yieldUnit: act.metadata.unit || 'kg',
      grade: act.metadata.grade || 'A',
      sellingPrice: act.metadata.sellingPrice || 40
    });

    this.showActivityModal.set(true);
  }

  onDeleteActivity(id: string): void {
    if (confirm('Are you sure you want to delete this activity record?')) {
      this.timelineService.deleteActivity(id);
    }
  }

  onSubmitActivity(): void {
    if (this.activityForm.invalid) return;

    const values = this.activityForm.value;
    const crop = this.selectedCrop()!;

    // Compile event-specific metadata
    const metadata: Record<string, any> = {};
    if (values.type === 'Irrigation') {
      metadata['irrigationMethod'] = values.irrigationMethod;
      metadata['duration'] = Number(values.duration);
      metadata['waterQuantity'] = Number(values.waterQuantity);
    } else if (values.type === 'Fertilizer Application') {
      metadata['fertilizerName'] = values.fertilizerName;
      metadata['quantity'] = Number(values.fertilizerQuantity);
      metadata['applicationMethod'] = values.applicationMethod;
    } else if (values.type === 'Spray Application') {
      metadata['chemicalName'] = values.chemicalName;
      metadata['dosage'] = values.dosage;
      metadata['waterQuantity'] = Number(values.sprayWaterQuantity);
      metadata['targetPest'] = values.targetPest;
    } else if (values.type === 'Harvest') {
      metadata['yieldQuantity'] = Number(values.yieldQuantity);
      metadata['unit'] = values.yieldUnit;
      metadata['grade'] = values.grade;
      metadata['sellingPrice'] = Number(values.sellingPrice);
    }

    const activityPayload = {
      cropId: crop.id,
      type: values.type as ActivityType,
      date: new Date(values.date).toISOString(),
      status: values.status as ActivityStatus,
      cost: Number(values.cost),
      notes: values.notes,
      attachments: this.uploadedImages(),
      metadata: metadata
    };

    const isEdit = this.editingActivity();
    if (isEdit) {
      this.timelineService.updateActivity(isEdit.id, activityPayload);
    } else {
      this.timelineService.addActivity(activityPayload);
    }

    // Auto advance growth stage in crop if registering a completed Harvest activity
    if (values.type === 'Harvest' && values.status === 'Completed') {
      this.timelineService.updateCrop(crop.id, { currentStage: 'Harvest' });
    }

    this.showActivityModal.set(false);
  }

  // --- Attachments Handling (Simulated Image Upload base64 Conversion) ---
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      
      reader.onload = () => {
        const base64String = reader.result as string;
        this.uploadedImages.update(current => [...current, base64String]);
      };

      reader.readAsDataURL(file);
    }
  }

  removeImage(index: number): void {
    this.uploadedImages.update(current => current.filter((_, i) => i !== index));
  }

  getActivityIcon(type: ActivityType): string {
    const item = this.activityTypes.find(a => a.type === type);
    return item ? item.icon : 'bi-calendar-event';
  }

  getActivityEmoji(type: ActivityType): string {
    switch (type) {
      case 'Sowing': return '🌱';
      case 'Irrigation': return '💧';
      case 'Fertilizer Application': return '🌿';
      case 'Spray Application': return '🐛';
      case 'Weeding': return '✂️';
      case 'Field Inspection': return '📷';
      case 'Labour Activity': return '👥';
      case 'Harvest': return '🌾';
      case 'Sale': return '💰';
      case 'Weather Incident': return '⚡';
      default: return '📅';
    }
  }

  getActivityColor(type: ActivityType): string {
    const item = this.activityTypes.find(a => a.type === type);
    return item ? item.color : '#4a5568';
  }

  markActivityCompleted(id: string): void {
    this.timelineService.updateActivity(id, {
      status: 'Completed',
      date: new Date().toISOString()
    });
  }

  navigateToMap(): void {
    this.router.navigate(['/map']);
  }
}
