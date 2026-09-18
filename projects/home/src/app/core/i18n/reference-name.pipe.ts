import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { ReferenceNameCategory, resolveReferenceName } from './reference-name';

/**
 * `{{ crop.name | referenceName:'crop' }}` — see `resolveReferenceName` for
 * the lookup/fallback rule. Impure so it re-renders on a runtime language
 * switch (`LanguageService`), not just on `name`/`category` changes.
 */
@Pipe({ name: 'referenceName', pure: false })
export class ReferenceNamePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(name: string | null | undefined, category: ReferenceNameCategory): string {
    if (!name) {
      return '';
    }
    return resolveReferenceName(this.translate, category, name);
  }
}
