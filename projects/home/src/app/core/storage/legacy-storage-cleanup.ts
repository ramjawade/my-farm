/** Keys that identify the signed-in session. */
const SESSION_KEYS = ['my_farm_session_token', 'my_farm_active_user_id', 'my_farm_session_expiry'];

/** Current per-farmer keys that must survive a reload (everything else with an app prefix is legacy). */
const KEPT_PREFIXES = ['my_farm_report_generated_'];

const APP_PREFIXES = ['my_farm_', 'mf-'];

/**
 * Removes localStorage keys left behind by older versions of the app, keeping the session keys
 * and the current per-farmer keys listed above. Keys the app does not own are never touched.
 */
export function cleanupLegacyLocalStorage(storage: Storage = localStorage): void {
  const stale: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (
      key &&
      APP_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
      !SESSION_KEYS.includes(key) &&
      !KEPT_PREFIXES.some((prefix) => key.startsWith(prefix))
    ) {
      stale.push(key);
    }
  }
  stale.forEach((key) => storage.removeItem(key));
}
