import { TestBed } from '@angular/core/testing';

import { EnvironmentService } from './environment.service';
import { environment } from '../../../environments/environment';

describe('EnvironmentService', () => {
  let service: EnvironmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EnvironmentService);
  });

  it('is created as a singleton', () => {
    const other = TestBed.inject(EnvironmentService);
    expect(service).toBe(other);
  });

  it('exposes the configured environment values', () => {
    expect(service.production).toBe(environment.production);
    expect(service.appVersion).toBe(environment.appVersion);
    expect(service.buildStamp).toBe(environment.buildStamp);
    expect(service.apiBaseUrl).toBe(environment.apiBaseUrl);
  });

  it('getApiUrl returns the configured API base URL', () => {
    expect(service.getApiUrl()).toBe(environment.apiBaseUrl);
  });

  it('isDevelopment/isProduction reflect the production flag', () => {
    expect(service.isDevelopment()).toBe(!environment.production);
    expect(service.isProduction()).toBe(environment.production);
  });
});
