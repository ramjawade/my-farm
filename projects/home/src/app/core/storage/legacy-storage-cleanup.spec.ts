import { cleanupLegacyLocalStorage } from './legacy-storage-cleanup';

describe('cleanupLegacyLocalStorage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('removes legacy app keys', () => {
    localStorage.setItem('my_farm_farmers', '[]');
    localStorage.setItem('mf-theme', 'dark');

    cleanupLegacyLocalStorage();

    expect(localStorage.getItem('my_farm_farmers')).toBeNull();
    expect(localStorage.getItem('mf-theme')).toBeNull();
  });

  it('keeps the session keys', () => {
    localStorage.setItem('my_farm_session_token', 't');
    localStorage.setItem('my_farm_active_user_id', '1');
    localStorage.setItem('my_farm_session_expiry', '99');

    cleanupLegacyLocalStorage();

    expect(localStorage.length).toBe(3);
  });

  it('keeps the per-farmer "report generated" flags so progress survives a reload', () => {
    localStorage.setItem('my_farm_report_generated_3', '1');
    localStorage.setItem('my_farm_report_generated_8', '1');

    cleanupLegacyLocalStorage();

    expect(localStorage.getItem('my_farm_report_generated_3')).toBe('1');
    expect(localStorage.getItem('my_farm_report_generated_8')).toBe('1');
  });

  it('never touches keys the app does not own', () => {
    localStorage.setItem('some_other_app', 'x');

    cleanupLegacyLocalStorage();

    expect(localStorage.getItem('some_other_app')).toBe('x');
  });

  it('removes every stale key even when several are adjacent', () => {
    for (let i = 0; i < 6; i++) localStorage.setItem(`my_farm_old_${i}`, String(i));
    localStorage.setItem('my_farm_report_generated_1', '1');

    cleanupLegacyLocalStorage();

    expect(localStorage.length).toBe(1);
  });
});
