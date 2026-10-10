import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  effect,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';

let nextId = 0;

/**
 * Confirmation dialog: centred on wide screens, a bottom sheet below 576px.
 * Focus moves to Cancel on open, Tab cycles between the two buttons,
 * Escape cancels, and focus returns to the opener on close.
 */
@Component({
  selector: 'lib-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class ConfirmDialogComponent {
  private readonly document = inject(DOCUMENT);

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

  readonly titleId = `confirm-title-${nextId}`;
  readonly messageId = `confirm-message-${nextId++}`;

  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelBtn');
  private opener: HTMLElement | null = null;

  constructor() {
    // Focus management only (no API calls): Cancel gets focus when the
    // dialog renders; the opener gets it back when it closes.
    effect(() => {
      const button = this.cancelButton();
      if (button) {
        this.opener = this.document.activeElement as HTMLElement | null;
        button.nativeElement.focus();
      } else if (this.opener) {
        this.opener.focus();
        this.opener = null;
      }
    });
  }

  onConfirm(): void {
    this.confirm.emit();
    this.isOpen.set(false);
  }

  onCancel(): void {
    this.cancel.emit();
    this.isOpen.set(false);
  }

  onEscape(): void {
    if (this.isOpen()) this.onCancel();
  }

  /** Keeps Tab focus inside the dialog by wrapping between its two buttons. */
  wrapFocus(event: Event, target: HTMLButtonElement): void {
    event.preventDefault();
    target.focus();
  }
}
