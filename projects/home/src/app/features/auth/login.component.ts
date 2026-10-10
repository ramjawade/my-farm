import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { SessionAuthService, SessionResult } from '../../core/auth/session-auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { BrandLogoComponent } from '../../layout/brand-logo/brand-logo.component';
import { LanguageSwitchComponent } from '../../layout/language-switch/language-switch.component';
import { FarmerRegistrationService } from '../farmer-registration/farmer-registration.service';
import { NumberPadComponent, PadKey } from './number-pad/number-pad.component';
import { WarliSceneComponent } from './warli-scene/warli-scene.component';

export type LoginStep = 'phone' | 'pin' | 'name' | 'create' | 'confirm' | 'done';

/** Steps that are filled in with the number pad. */
type PadStep = 'phone' | 'pin' | 'create' | 'confirm';

export const PHONE_LENGTH = 10;
export const NEW_PIN_LENGTH = 4;
/** Existing accounts may hold a PIN of up to 6 digits (the server accepts 4 to 6). */
export const SIGN_IN_PIN_MAX = 6;
const MIN_NAME_LENGTH = 3;
const REVEAL_MS = 900;
const WELCOME_MS = 1600;

/** Which part of the screen to shake after a mistake. */
type ShakeTarget = 'number' | 'pin' | 'name';

/**
 * Sign-in and registration on one stepped screen (issues #45, #50).
 * **Online-only**: every step that needs the backend shows a retry message on
 * a network failure and never creates a local account — an identity can't be
 * minted offline and reconciled later.
 */
@Component({
  selector: 'app-login',
  imports: [
    TranslatePipe,
    FormsModule,
    BrandLogoComponent,
    LanguageSwitchComponent,
    NumberPadComponent,
    WarliSceneComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly sessionAuth = inject(SessionAuthService);
  private readonly farmerService = inject(FarmerRegistrationService);
  private readonly router = inject(Router);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly step = signal<LoginStep>('phone');
  readonly phone = signal('');
  readonly pin = signal('');
  readonly newPin = signal('');
  readonly confirmPin = signal('');
  readonly name = signal('');
  readonly busy = signal(false);
  readonly reveal = signal(false);
  /** Translation key of the message under the input, or null. */
  readonly error = signal<string | null>(null);
  readonly shake = signal<ShakeTarget | null>(null);
  /** Index of the PIN digit just typed, shown briefly before it is masked. */
  readonly flashIndex = signal(-1);
  readonly welcomeName = signal('');

  private readonly isNew = signal(false);
  private flashTimer: ReturnType<typeof setTimeout> | undefined;
  private welcomeTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly nameField = viewChild<ElementRef<HTMLInputElement>>('nameField');

  /** Steps shown in the progress dots for this visit. */
  protected readonly flow = computed<readonly LoginStep[]>(() =>
    this.isNew() ? ['phone', 'name', 'create', 'confirm'] : ['phone', 'pin'],
  );
  protected readonly stepIndex = computed(() =>
    this.step() === 'done' ? this.flow().length : this.flow().indexOf(this.step()),
  );

  /** Digits of the number as ten slots; the slot after the last digit is the cursor. */
  protected readonly phoneSlots = computed(() => {
    const digits = this.phone();
    return Array.from({ length: PHONE_LENGTH }, (_, i) => ({
      digit: digits[i] ?? '0',
      filled: i < digits.length,
      cursor: i === digits.length,
    }));
  });

  protected readonly pinValue = computed(() => this.valueOf(this.step()));
  /** Four boxes, growing to six only while an existing account's longer PIN is typed. */
  protected readonly pinBoxes = computed(() => {
    const value = this.pinValue();
    const count = Math.max(NEW_PIN_LENGTH, value.length);
    return Array.from({ length: count }, (_, i) => ({
      filled: i < value.length,
      cursor: i === value.length,
      char: this.reveal() || i === this.flashIndex() ? value[i] : '•',
    }));
  });

  protected readonly showDevanagari = computed(() => this.languageService.language() !== 'en');
  protected readonly displayPhone = computed(() => {
    const p = this.phone();
    return `+91 ${p.slice(0, 5)} ${p.slice(5)}`.trim();
  });
  protected readonly titleKey = computed(() => `login.title.${this.step()}`);
  protected readonly hintKey = computed(() => {
    const step = this.step();
    return step === 'pin' ? null : `login.hint.${step}`;
  });
  protected readonly usesPad = computed(() => this.step() !== 'name' && this.step() !== 'done');

  constructor() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/map']);
    }
    effect(() => this.nameField()?.nativeElement.focus());
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.flashTimer);
      clearTimeout(this.welcomeTimer);
    });
  }

  protected onKey(key: PadKey): void {
    if (this.busy()) return;
    if (key === 'ok') {
      void this.submit();
    } else if (key === 'del') {
      this.edit((value) => value.slice(0, -1));
    } else {
      this.type(key);
    }
  }

  /** Physical keyboard: digits type, Backspace deletes, Enter goes on. */
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.usesPad() || this.busy() || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('button, input, textarea, select, a')) {
      return;
    }
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      this.type(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.onKey('del');
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.onKey('ok');
    }
  }

  protected toggleReveal(): void {
    this.reveal.update((value) => !value);
  }

  protected changeNumber(): void {
    this.pin.set('');
    this.fail(null);
    this.step.set('phone');
  }

  protected onNameInput(value: string): void {
    this.name.set(value);
    this.error.set(null);
  }

  protected async submit(): Promise<void> {
    switch (this.step()) {
      case 'phone':
        return this.submitPhone();
      case 'pin':
        return this.submitPin();
      case 'name':
        return this.submitName();
      case 'create':
        return this.submitNewPin();
      case 'confirm':
        return this.submitConfirm();
      case 'done':
        return;
    }
  }

  private submitPhone(): void {
    if (this.phone().length !== PHONE_LENGTH) {
      this.fail('login.errPhone', 'number');
      return;
    }
    this.pin.set('');
    this.isNew.set(false);
    this.go('pin');
  }

  private async submitPin(): Promise<void> {
    if (this.pin().length < NEW_PIN_LENGTH) {
      this.fail('login.errPin', 'pin');
      return;
    }
    this.busy.set(true);
    try {
      const outcome = await this.sessionAuth.createSession(this.phone(), this.pin());
      switch (outcome.status) {
        case 'ok':
          this.finish(outcome.result);
          return;
        case 'no-account':
          // First time on this number: the typed PIN is dropped and a new one is chosen later.
          this.isNew.set(true);
          this.pin.set('');
          this.name.set('');
          this.go('name');
          return;
        case 'wrong-pin':
          this.pin.set('');
          this.fail('login.errWrongPin', 'pin');
          return;
        case 'locked':
          this.pin.set('');
          this.fail('login.errLocked');
          return;
        case 'unreachable':
          this.fail('login.errUnreachable');
          return;
      }
    } finally {
      this.busy.set(false);
    }
  }

  private submitName(): void {
    if (this.name().trim().length < MIN_NAME_LENGTH) {
      this.fail('login.errName', 'name');
      return;
    }
    this.newPin.set('');
    this.go('create');
  }

  private submitNewPin(): void {
    if (this.newPin().length !== NEW_PIN_LENGTH) {
      this.fail('login.errPin', 'pin');
      return;
    }
    this.confirmPin.set('');
    this.go('confirm');
  }

  private async submitConfirm(): Promise<void> {
    if (this.confirmPin().length !== NEW_PIN_LENGTH) {
      this.fail('login.errPin', 'pin');
      return;
    }
    if (this.confirmPin() !== this.newPin()) {
      this.newPin.set('');
      this.confirmPin.set('');
      this.step.set('create');
      this.fail('login.errPinMismatch', 'pin');
      return;
    }
    this.busy.set(true);
    try {
      const outcome = await this.sessionAuth.register({
        phone: this.phone(),
        fullName: this.name().trim(),
        pin: this.newPin(),
        preferredLanguage: this.languageService.language(),
      });
      switch (outcome.status) {
        case 'ok':
          this.finish(outcome.result);
          return;
        case 'phone-taken':
          this.isNew.set(false);
          this.pin.set('');
          this.step.set('pin');
          this.fail('login.errTaken');
          return;
        case 'unreachable':
          this.fail('login.errUnreachable');
          return;
      }
    } finally {
      this.busy.set(false);
    }
  }

  private valueOf(step: LoginStep): string {
    switch (step) {
      case 'phone':
        return this.phone();
      case 'pin':
        return this.pin();
      case 'create':
        return this.newPin();
      case 'confirm':
        return this.confirmPin();
      default:
        return '';
    }
  }

  private maxLength(step: PadStep): number {
    if (step === 'phone') return PHONE_LENGTH;
    return step === 'pin' ? SIGN_IN_PIN_MAX : NEW_PIN_LENGTH;
  }

  private edit(change: (value: string) => string): void {
    const step = this.step();
    if (step === 'name' || step === 'done') return;
    const sig = this.bufferFor(step);
    sig.update(change);
    this.error.set(null);
    this.flashIndex.set(-1);
    clearTimeout(this.flashTimer);
  }

  private type(digit: string): void {
    const step = this.step();
    if (step === 'name' || step === 'done') return;
    if (this.valueOf(step).length >= this.maxLength(step)) return;
    this.edit((value) => value + digit);
    if (step !== 'phone') {
      this.flashIndex.set(this.valueOf(step).length - 1);
      this.flashTimer = setTimeout(() => this.flashIndex.set(-1), REVEAL_MS);
    }
  }

  private bufferFor(step: PadStep) {
    switch (step) {
      case 'phone':
        return this.phone;
      case 'pin':
        return this.pin;
      case 'create':
        return this.newPin;
      case 'confirm':
        return this.confirmPin;
    }
  }

  private go(step: LoginStep): void {
    this.error.set(null);
    this.flashIndex.set(-1);
    this.step.set(step);
  }

  private fail(messageKey: string | null, target: ShakeTarget | null = null): void {
    this.error.set(messageKey);
    this.shake.set(target);
    // Reset after the animation so the same mistake can shake again.
    if (target) setTimeout(() => this.shake.set(null), 400);
  }

  /** Greet the farmer, then sign in. login() runs first so the API session token is
   * bound before upsertFarmer() triggers a PATCH /me through the storage layer. */
  private finish(session: SessionResult): void {
    this.error.set(null);
    this.welcomeName.set(session.farmer.fullName.trim().split(/\s+/)[0] ?? '');
    this.go('done');
    this.welcomeTimer = setTimeout(() => {
      this.authService.login(session.farmer, session.token);
      this.farmerService.upsertFarmer(session.farmer);
      this.router.navigate(['/map']);
    }, WELCOME_MS);
  }
}
