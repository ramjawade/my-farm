import { Injector, Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { ReferenceDataService } from '../api/reference-data.service';
import { ReferenceNameCategory, resolveReferenceName } from './reference-name';

/**
 * `{{ crop.name | referenceName:'crop' }}` — see `resolveReferenceName` for
 * the lookup/fallback rule. Also accepts a reference id
 * (`{{ act.activityTypeId | referenceName:'activity' }}`), which is looked up
 * in `ReferenceDataService` first (`''` until loaded or if unknown).
 * Impure so it re-renders on a runtime language switch (`LanguageService`)
 * and when reference data arrives, not just on input changes.
 */
@Pipe({ name: 'referenceName', pure: false })
export class ReferenceNamePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);
  private readonly injector = inject(Injector);

  transform(value: string | number | null | undefined, category: ReferenceNameCategory): string {
    const name = typeof value === 'number' ? this.nameForId(value, category) : value;
    if (!name) {
      return '';
    }
    return resolveReferenceName(this.translate, category, name);
  }

  // Resolved lazily so templates that only pass names never need HttpClient.
  private nameForId(id: number, category: ReferenceNameCategory): string {
    const data = this.injector.get(ReferenceDataService);
    switch (category) {
      case 'crop':
        return data.cropName(id);
      case 'activity':
        return data.activityTypeName(id);
      case 'expense':
        return data.expenseCategoryName(id);
      default:
        return '';
    }
  }
}
