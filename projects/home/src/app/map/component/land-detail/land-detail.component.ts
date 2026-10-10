import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { I18n } from '../../../core/i18n/i18n.service';
import { waterSourceKey } from '../../models/land-options';
import { CropEntity } from '../../../features/crop-timeline/crop-timeline.models';
import { LocalNumberPipe } from '../../../core/i18n/localized.pipes';
import { SavedFarm } from '../../models/map.models';

/** The selected land: what grows on it and what it costs. Presentation only. */
@Component({
  selector: 'app-land-detail',
  imports: [TranslatePipe, LocalNumberPipe],
  templateUrl: './land-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandDetailComponent {
  private readonly i18n = inject(I18n);

  readonly land = input.required<SavedFarm>();
  readonly crops = input<CropEntity[]>([]);
  /** Expenses logged on this land's crops. */
  readonly expenses = input(0);

  readonly addCrop = output<void>();
  readonly viewCrop = output<number>();
  readonly notesUpdated = output<{ id: number; notes: string }>();

  readonly editingNotes = signal(false);
  readonly notesValue = signal('');

  readonly costPerAcre = computed(() => {
    const acres = this.land().area.acres;
    return acres > 0 ? Math.round(this.expenses() / acres) : null;
  });

  /** The water source in the active language; unknown values show as stored. */
  readonly waterLabel = computed(() => {
    const value = this.land().waterSource;
    if (!value) return '';
    const key = waterSourceKey(value);
    const label = this.i18n.t(key);
    return label === key ? value : label;
  });

  startEditingNotes(): void {
    this.notesValue.set(this.land().notes ?? '');
    this.editingNotes.set(true);
  }

  saveNotes(): void {
    this.notesUpdated.emit({ id: this.land().id, notes: this.notesValue() });
    this.editingNotes.set(false);
  }

  onNotesInput(event: Event): void {
    this.notesValue.set((event.target as HTMLTextAreaElement).value);
  }
}
