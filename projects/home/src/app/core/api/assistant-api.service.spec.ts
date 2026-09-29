import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HttpService } from '../http/http.service';
import { AssistantApiService } from './assistant-api.service';

describe('AssistantApiService', () => {
  let service: AssistantApiService;
  let http: jasmine.SpyObj<HttpService>;

  beforeEach(() => {
    http = jasmine.createSpyObj('HttpService', ['get', 'post', 'delete']);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: HttpService, useValue: http }],
    });
    service = TestBed.inject(AssistantApiService);
  });

  it('asks with the text and language', async () => {
    http.post.and.resolveTo({ intent: 'log' });

    await service.ask('hello', 'mr');

    expect(http.post).toHaveBeenCalledWith('/assistant/ask', { text: 'hello', language: 'mr' });
  });

  it('sends a null language when none is known, so the backend falls back to the profile', async () => {
    http.post.and.resolveTo({ intent: 'log' });

    await service.ask('hello');

    expect(http.post).toHaveBeenCalledWith('/assistant/ask', { text: 'hello', language: null });
  });

  it('lets a failed ask reach the caller unchanged', async () => {
    http.post.and.rejectWith({ status: 503 });

    await expectAsync(service.ask('hello')).toBeRejectedWith({ status: 503 });
  });

  it('lists messages, passing "before" only when paging', async () => {
    http.get.and.resolveTo({ items: [], has_more: false });

    await service.listMessages();
    await service.listMessages(20, 99);

    expect(http.get.calls.argsFor(0)).toEqual(['/assistant/messages', { limit: '50' }]);
    expect(http.get.calls.argsFor(1)).toEqual([
      '/assistant/messages',
      { limit: '20', before: '99' },
    ]);
  });

  it('appends, fetches the brief and clears', async () => {
    http.post.and.resolveTo([]);
    http.get.and.resolveTo({ has_data: false });
    http.delete.and.resolveTo(undefined);

    await service.appendMessages([{ role: 'bot', kind: 'text', text: 'hi' }]);
    await service.brief();
    await service.clearMessages();

    expect(http.post).toHaveBeenCalledWith('/assistant/messages', {
      messages: [{ role: 'bot', kind: 'text', text: 'hi' }],
    });
    expect(http.get).toHaveBeenCalledWith('/assistant/brief');
    expect(http.delete).toHaveBeenCalledWith('/assistant/messages');
  });
});
