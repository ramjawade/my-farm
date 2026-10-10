import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalNumberPipe } from '../../../core/i18n/localized.pipes';
import { LAND_WATER_SOURCES, waterSourceKey } from '../../models/land-options';
import { FarmAreaResult } from '../../models/map.models';

export interface LandDetails {
  name: string;
  waterSource: string;
  notes: string;
}

/** Step 2 of drawing a land: name it and add optional details. */
@Component({
  selector: 'app-land-save-form',
  imports: [ReactiveFormsModule, TranslatePipe, LocalNumberPipe],
  templateUrl: './land-save-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandSaveFormComponent {
  readonly area = input.required<FarmAreaResult>();
  readonly saving = input(false);

  readonly save = output<LandDetails>();
  readonly discard = output<void>();

  readonly waterSources = LAND_WATER_SOURCES;
  readonly waterKey = waterSourceKey;

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    waterSource: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
  });

  submit(): void {
    if (this.saving()) return;
    const { name, waterSource, notes } = this.form.getRawValue();
    if (!name.trim()) {
      this.form.controls.name.markAsTouched();
      return;
    }
    this.save.emit({ name: name.trim(), waterSource, notes });
  }
}
