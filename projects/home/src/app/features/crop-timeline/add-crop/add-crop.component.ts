import {
  Component,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CROP_STAGES, CropEntity } from '../crop-timeline.models';
import { CropTimelineService } from '../crop-timeline.service';
import { FARMING_METHODS, IRRIGATION_TYPES } from '../crop-timeline.utils';
import { parseId } from '../../../core/models/entity-id';
import { AddCropService } from './add-crop.service';
import { FarmLookupService } from '../../../core/farms/farm-lookup.service';
import { SavedFarm } from '../../../map/models/map.models';
import { AuthService } from '../../../core/auth/auth.service';
import { WorkflowStateService } from '../../../core/workflow/workflow-state.service';
import { ToastService, ComboboxComponent } from 'shared';
import { SEASONS, seasonForDate } from '../../../core/models/season';
import { convertArea, AreaUnit } from '../../../core/pipes/area.pipe';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';
import { ReferenceDataService } from '../../../core/api/reference-data.service';

@Component({
  standalone: true,
  selector: 'app-add-crop',
  imports: [CommonModule, ReactiveFormsModule, ComboboxComponent, TranslatePipe, ReferenceNamePipe],
  templateUrl: './add-crop.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCropComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly addCropService = inject(AddCropService);
  private readonly farmLookup = inject(FarmLookupService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly workflowService = inject(WorkflowStateService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly timeline = inject(CropTimelineService);

  /** Set when editing an existing crop (`/crops/:cropId/edit`). */
  readonly editId = parseId(this.route.snapshot.paramMap.get('cropId'));
  readonly isEdit = this.editId !== null;
  readonly irrigationTypes = IRRIGATION_TYPES;
  readonly farmingMethods = FARMING_METHODS;

  readonly savedFarms = signal<SavedFarm[]>([]);
  readonly crops = signal<CropEntity[]>([]);
  readonly creatingName = signal(false);
  readonly saving = signal(false);
  readonly areaIsAutoFilled = signal(true);

  readonly cropForm = this.fb.nonNullable.group({
    season: [seasonForDate(), Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
    fieldId: [null as number | null, Validators.required],
    area: ['', [Validators.required, Validators.min(0.01)]],
    areaUnit: ['hectares', Validators.required],
    sowingDate: ['', Validators.required],
    irrigationType: [''],
    farmingMethod: [''],
  });

  /** No saved land to link a crop to. */
  readonly noLands = computed(() => this.loaded() && this.savedFarms().length === 0);
  private readonly loaded = signal(false);

  readonly seasons = SEASONS;
  readonly cropNames = computed(() => {
    const names = this.crops().map((c) => c.name);
    return [...new Set(names)].sort();
  });

  constructor() {
    const fieldIdCtrl = this.cropForm.get('fieldId');
    const areaCtrl = this.cropForm.get('area');
    const areaUnitCtrl = this.cropForm.get('areaUnit');

    fieldIdCtrl?.valueChanges.pipe(takeUntilDestroyed()).subscribe((fieldId) => {
      if (fieldId) {
        const farm = this.savedFarms().find((f) => f.id === fieldId);
        if (farm) {
          const unit = (areaUnitCtrl?.value as AreaUnit) || 'hectares';
          const areaValue = unit === 'acres' ? farm.area.acres : farm.area.hectares;
          areaCtrl?.setValue(String(areaValue), { emitEvent: false });
          this.areaIsAutoFilled.set(true);
        }
      }
    });

    areaUnitCtrl?.valueChanges.pipe(takeUntilDestroyed()).subscribe((newUnit) => {
      const fieldId = fieldIdCtrl?.value;
      const currentArea = areaCtrl?.value;
      if (this.areaIsAutoFilled() && fieldId && currentArea) {
        const farm = this.savedFarms().find((f) => f.id === fieldId);
        if (farm) {
          const areaValue =
            (newUnit as AreaUnit) === 'acres' ? farm.area.acres : farm.area.hectares;
          areaCtrl?.setValue(String(areaValue), { emitEvent: false });
        }
      } else if (!this.areaIsAutoFilled() && currentArea) {
        const oldUnit = newUnit === 'acres' ? 'hectares' : 'acres';
        const converted = convertArea(
          Number(currentArea),
          oldUnit as AreaUnit,
          newUnit as AreaUnit,
        );
        areaCtrl?.setValue(String(converted), { emitEvent: false });
      }
    });

    areaCtrl?.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.areaIsAutoFilled.set(false);
    });
  }

  async ngOnInit(): Promise<void> {
    const user = this.authService.currentUser();
    if (user) {
      const [farms, crops] = await Promise.all([
        this.farmLookup.loadForCurrentUser(),
        this.addCropService.getCrops(),
      ]);
      this.savedFarms.set(farms);
      this.crops.set(crops);
      this.loaded.set(true);
      if (this.isEdit) {
        this.prefill(crops.find((c) => c.id === this.editId));
        return;
      }
      // Preselect the land the farmer came from (?landId=), else the only land
      const landId = Number(this.route.snapshot.queryParamMap.get('landId'));
      const requested = this.savedFarms().find((f) => f.id === landId);
      if (requested) {
        this.cropForm.patchValue({ fieldId: requested.id });
      } else if (this.savedFarms().length === 1) {
        this.cropForm.patchValue({ fieldId: this.savedFarms()[0].id });
      }
    }
  }

  /** Fill the form from the crop being edited; its land cannot change. */
  private prefill(crop: CropEntity | undefined): void {
    if (!crop) {
      this.router.navigate(['/crops']);
      return;
    }
    this.cropForm.patchValue(
      {
        season: crop.season ?? seasonForDate(),
        name: crop.name,
        fieldId: crop.fieldId,
        area: String(crop.area),
        areaUnit: crop.areaUnit,
        sowingDate: crop.sowingDate ? new Date(crop.sowingDate).toISOString().slice(0, 10) : '',
        irrigationType: crop.irrigationType ?? '',
        farmingMethod: crop.farmingMethod ?? '',
      },
      { emitEvent: false },
    );
    this.cropForm.controls.fieldId.disable({ emitEvent: false });
    this.areaIsAutoFilled.set(false);
  }

  onCancel(): void {
    this.router.navigate(this.isEdit ? ['/crops', this.editId] : ['/crops']);
  }

  onNameAdded(newName: string): void {
    this.creatingName.set(true);
    this.cropForm.patchValue({ name: newName });
    this.creatingName.set(false);
  }

  async onSubmit(): Promise<void> {
    const values = this.cropForm.getRawValue();
    if (!this.cropForm.valid || this.creatingName() || this.saving() || values.fieldId === null) {
      return;
    }

    this.saving.set(true);
    try {
      // Create-or-get: a farmer-typed crop name with no catalog entry becomes one.
      const cropCatalogId = await this.referenceData.cropCatalogIdForName(values.name);
      const sowingDate = values.sowingDate ? new Date(values.sowingDate).getTime() : undefined;

      if (this.isEdit && this.editId !== null) {
        // An empty choice clears the optional field.
        this.timeline.updateCrop(this.editId, {
          name: values.name,
          cropCatalogId,
          area: Number(values.area),
          areaUnit: values.areaUnit as 'acres' | 'hectares',
          season: values.season,
          sowingDate,
          irrigationType: values.irrigationType,
          farmingMethod: values.farmingMethod,
        });
        this.toast.success(this.translate.instant('addCrop.updatedToast', { name: values.name }));
        this.router.navigate(['/crops', this.editId]);
        return;
      }

      const newCrop = await this.addCropService.createCrop({
        name: values.name,
        cropCatalogId,
        fieldId: values.fieldId,
        area: Number(values.area),
        areaUnit: values.areaUnit as 'acres' | 'hectares',
        season: values.season,
        sowingDate,
        irrigationType: values.irrigationType || undefined,
        farmingMethod: values.farmingMethod || undefined,
        currentStage: CROP_STAGES[0],
        status: 'Active',
      });

      this.workflowService.markPhaseComplete('crop');
      this.toast.success(this.translate.instant('addCrop.savedToast', { name: newCrop.name }));

      this.cropForm.reset({
        season: seasonForDate(),
        name: '',
        fieldId: null,
        area: '',
        areaUnit: 'hectares',
        sowingDate: '',
        irrigationType: '',
        farmingMethod: '',
      });

      this.router.navigate(['/crops']);
    } catch {
      this.toast.error(this.translate.instant('addCrop.saveError'));
    } finally {
      this.saving.set(false);
    }
  }
}
