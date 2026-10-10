import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'del' | 'ok';

const KEYS: readonly PadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
const DEVANAGARI = '०१२३४५६७८९';

/** On-screen 3 x 4 number pad for the sign-in steps. Presentation only: it reports the key tapped. */
@Component({
  selector: 'app-number-pad',
  imports: [TranslatePipe],
  templateUrl: './number-pad.component.html',
  styleUrl: './number-pad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberPadComponent {
  /** A request is running: keys are disabled and Next shows a spinner. */
  readonly busy = input(false);
  /** Show the Devanagari numeral under each digit. */
  readonly devanagari = input(false);

  readonly key = output<PadKey>();

  protected readonly keys = KEYS;

  protected numeral(key: PadKey): string {
    return DEVANAGARI[Number(key)];
  }
}
