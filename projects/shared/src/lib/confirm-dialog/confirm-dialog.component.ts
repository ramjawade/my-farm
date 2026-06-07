import { Component, ChangeDetectionStrategy, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmDialogComponent {
  // Inputs (Signals)
  readonly title = input<string>('Confirm Action');
  readonly message = input<string>('Are you sure you want to perform this action?');
  readonly confirmText = input<string>('Confirm');
  readonly cancelText = input<string>('Cancel');
  readonly isDestructive = input<boolean>(false);

  // Two-way binding for visibility
  readonly isOpen = model<boolean>(false);

  // Outputs
  readonly confirm = output<void>();
  readonly cancel = output<void>();

  onConfirm(): void {
    this.confirm.emit();
    this.isOpen.set(false);
  }

  onCancel(): void {
    this.cancel.emit();
    this.isOpen.set(false);
  }
}
