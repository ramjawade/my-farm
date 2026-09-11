import { inject, provideAppInitializer } from '@angular/core';

import { EnvironmentService } from './environment.service';

/**
 * Ensures `EnvironmentService` is constructed (and its config loaded)
 * before the app renders, so it's safe to inject anywhere from the start.
 */
export function provideEnvironmentInitializer() {
  return provideAppInitializer(() => {
    inject(EnvironmentService);
  });
}
