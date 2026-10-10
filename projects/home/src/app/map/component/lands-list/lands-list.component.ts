import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CropEntity } from '../../../features/crop-timeline/crop-timeline.models';
import { LocalNumberPipe } from '../../../core/i18n/localized.pipes';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';
import { SavedFarm } from '../../models/map.models';
import { LandOutlineComponent } from '../land-outline/land-outline.component';

/** The "All lands" list: one card per land. Presentation only. */
@Component({
  selector: 'app-lands-list',
  imports: [TranslatePipe, ReferenceNamePipe, LocalNumberPipe, LandOutlineComponent],
  templateUrl: './lands-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'menuId.set(null)' },
})
export class LandsListComponent {
  readonly farms = input.required<SavedFarm[]>();
  readonly selectedId = input<number | null>(null);
  /** Crops growing on each land, keyed by land id. */
  readonly cropsByLand = input<Partial<Record<number, CropEntity[]>>>({});

  readonly selectLand = output<SavedFarm>();
  readonly renameLand = output<{ id: number; name: string }>();
  readonly deleteLand = output<number>();

  readonly menuId = signal<number | null>(null);
  readonly renamingId = signal<number | null>(null);
  readonly renameValue = signal('');
  readonly renameError = signal(false);

  toggleMenu(id: number): void {
    this.menuId.update((open) => (open === id ? null : id));
  }

  startRename(farm: SavedFarm): void {
    this.menuId.set(null);
    this.renameValue.set(farm.name);
    this.renameError.set(false);
    this.renamingId.set(farm.id);
  }

  confirmRename(id: number): void {
    const name = this.renameValue().trim();
    if (!name) {
      this.renameError.set(true);
      return;
    }
    this.renameLand.emit({ id, name });
    this.cancelRename();
  }

  cancelRename(): void {
    this.renamingId.set(null);
    this.renameError.set(false);
  }

  remove(id: number): void {
    this.menuId.set(null);
    this.deleteLand.emit(id);
  }

  onRenameInput(event: Event): void {
    this.renameValue.set((event.target as HTMLInputElement).value);
    this.renameError.set(false);
  }
}
