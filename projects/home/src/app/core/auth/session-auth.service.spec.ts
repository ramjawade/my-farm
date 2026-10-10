import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { SessionAuthService } from './session-auth.service';

describe('SessionAuthService registration language', () => {
  let service: SessionAuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService(),
      ],
    });
    service = TestBed.inject(SessionAuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const farmer = (language: string | null) => ({
    token: 't',
    farmer: {
      id: 1,
      auth_uid: 'x',
      user_role: 'farmer',
      full_name: 'Ram',
      preferred_language: language,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    },
  });

  async function register(preferredLanguage?: string) {
    const done = service.register({
      phone: '9876543210',
      fullName: 'Ram',
      pin: '1234',
      preferredLanguage,
    });
    const req = http.expectOne((r) => r.url.endsWith('/auth/register'));
    const sent = req.request.body.preferred_language;
    req.flush(farmer(sent));
    const outcome = await done;
    return { sent, outcome };
  }

  it('sends the language the farmer chose before registering', async () => {
    expect((await register('en')).sent).toBe('en');
  });

  it('registers new farmers in Marathi when nothing was chosen', async () => {
    const { sent, outcome } = await register();

    expect(sent).toBe('mr');
    expect(outcome.status === 'ok' && outcome.result.farmer.preferredLanguage).toBe('mr');
  });
});
