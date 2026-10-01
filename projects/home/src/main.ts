import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { cleanupLegacyLocalStorage } from './app/core/storage/legacy-storage-cleanup';

function cleanupLegacyStorage(): void {
  // Delete offline outbox database
  try {
    indexedDB.deleteDatabase('my-farm-outbox');
  } catch {
    // IndexedDB may not be available or already cleared
  }

  cleanupLegacyLocalStorage();
}

cleanupLegacyStorage();
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
