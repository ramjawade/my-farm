import { Component, input, output } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-toolbar',
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss'
})
export class Toolbar {
  readonly menuExpanded = input(false);
  readonly menuToggle = output<void>();

  onMenuClick(): void {
    this.menuToggle.emit();
  }
}
