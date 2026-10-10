import { Pipe, PipeTransform, inject } from '@angular/core';

import { LocaleService } from './locale.service';

/**
 * `date` in the active language. Impure so the output changes the moment the
 * language does; it reads a signal, so zoneless change detection re-runs it.
 */
@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(
    value: Date | string | number | null | undefined,
    format = 'mediumDate',
  ): string | null {
    return value == null || value === '' ? null : this.locale.date(value, format);
  }
}

/** `number` with the active language's grouping (Indian) and Western digits. */
@Pipe({ name: 'localNumber', pure: false })
export class LocalNumberPipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(value: number | string | null | undefined, digitsInfo?: string): string | null {
    return value == null || value === '' || Number.isNaN(Number(value))
      ? null
      : this.locale.number(value, digitsInfo);
  }
}
