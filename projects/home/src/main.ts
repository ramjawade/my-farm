import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

function cleanupLegacyStorage(): void {
  // Delete offline outbox database
  try {
    indexedDB.deleteDatabase('my-farm-outbox');
  } catch {
    // IndexedDB may not be available or already cleared
  }

  // Remove legacy localStorage keys (keep only session keys)
  const sessionKeys = [
    'my_farm_session_token',
    'my_farm_active_user_id',
    'my_farm_session_expiry',
  ];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !sessionKeys.includes(key) && (key.startsWith('my_farm_') || key.startsWith('mf-'))) {
      localStorage.removeItem(key);
      i--; // Adjust index since we just removed an item
    }
  }
}

cleanupLegacyStorage();
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
