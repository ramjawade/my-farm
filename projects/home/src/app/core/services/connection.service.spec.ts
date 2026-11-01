import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ConnectionService } from './connection.service';

describe('ConnectionService', () => {
  function create(onLine: boolean): ConnectionService {
    spyOnProperty(window.navigator, 'onLine', 'get').and.returnValue(onLine);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    return TestBed.inject(ConnectionService);
  }

  it('starts from what the browser reports', () => {
    expect(create(true).online()).toBeTrue();
  });

  it('starts offline when the browser says so', () => {
    expect(create(false).online()).toBeFalse();
  });

  it('follows the offline and online events', () => {
    const service = create(true);

    window.dispatchEvent(new Event('offline'));
    expect(service.online()).toBeFalse();

    window.dispatchEvent(new Event('online'));
    expect(service.online()).toBeTrue();
  });

  it('stops listening once destroyed', () => {
    const service = create(true);
    TestBed.resetTestingModule();

    window.dispatchEvent(new Event('offline'));

    expect(service.online()).toBeTrue();
  });
});
