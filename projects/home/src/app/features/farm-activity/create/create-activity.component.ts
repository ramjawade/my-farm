import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FarmActivityService } from '../farm-activity.service';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';

@Component({
  selector: 'app-create-activity',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './create-activity.component.html',
  styleUrl: './create-activity.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateActivityComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly activityService = inject(FarmActivityService);
  private readonly cropService = inject(CropTimelineService);
  private readonly farmDrawService = inject(FarmDrawService);

  // Form group definition
  readonly form: FormGroup = this.fb.group({
    date: [new Date().toISOString().substring(0, 10), Validators.required],
    season: ['Kharif', Validators.required],
    activityId: ['', Validators.required],
    cropId: [''],
    fieldId: [''],
    status: ['In Progress', Validators.required],
    notes: ['']
  });

  // Populate dropdowns from services
  readonly crops = this.cropService.crops;
  readonly savedFarms = this.farmDrawService.savedFarms;

  // Pre-defined common suggestions
  readonly commonActivitySuggestions = [
    'Bore Installation',
    'Sowing',
    'Sowing Support',
    'Weeding',
    'Fertilizing',
    'Pest Spraying',
    'Harvesting',
    'Irrigation',
    'Field Inspection',
    'Tillage'
  ];

  selectSuggestion(val: string): void {
    this.form.patchValue({ activityId: val });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;
    
    // Create activity
    const newAct = this.activityService.addActivity({
      date: val.date,
      season: val.season,
      activityId: val.activityId.trim(),
      cropId: val.cropId || undefined,
      fieldId: val.fieldId || undefined,
      status: val.status,
      notes: val.notes?.trim() || undefined
    });

    // Navigate to detail view or dashboard
    this.router.navigate(['/activities', newAct.id]);
  }
}
