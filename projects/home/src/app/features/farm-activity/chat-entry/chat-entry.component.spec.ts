import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';

import {
  ChatEntryError,
  ChatEntryService,
  ResolvedEntry,
} from '../../../core/api/chat-entry.service';
import { Activity } from '../../activity/activity.models';
import { ChatEntryComponent } from './chat-entry.component';

function entry(overrides: Partial<ResolvedEntry> = {}): ResolvedEntry {
  return {
    transcript: '100 rs on North Plot',
    activity_type_id: 4,
    activity_type: 'Maintenance',
    date: '2026-09-20',
    crop_id: null,
    crop: null,
    land_id: 22,
    land: 'North Plot',
    notes: null,
    expenses: [],
    dropped: [],
    ...overrides,
  };
}

const ACTIVITY = { id: 99 } as Activity;

describe('ChatEntryComponent', () => {
  let fixture: ComponentFixture<ChatEntryComponent>;
  let component: ChatEntryComponent;
  let chatEntry: jasmine.SpyObj<ChatEntryService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    chatEntry = jasmine.createSpyObj<ChatEntryService>('ChatEntryService', [
      'parse',
      'create',
      'undo',
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['info', 'error', 'success']);

    await TestBed.configureTestingModule({
      imports: [ChatEntryComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService(),
        { provide: ChatEntryService, useValue: chatEntry },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates an entry and shows the undo card', async () => {
    chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'test-model' });
    chatEntry.create.and.resolveTo(ACTIVITY);

    component.form.setValue({ text: '100 rs on North Plot' });
    await component.submit();

    expect(chatEntry.create).toHaveBeenCalled();
    expect(component.created()?.activity.id).toBe(99);
  });

  it('passes the typed text and model through for provenance', async () => {
    // #244: what the farmer typed and which model read it must reach the
    // created entry, or the input-to-correction pairs #232 needs are lost.
    chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'test-model' });
    chatEntry.create.and.resolveTo(ACTIVITY);

    component.form.setValue({ text: '  100 rs on North Plot  ' });
    await component.submit();

    expect(chatEntry.create).toHaveBeenCalledWith(
      jasmine.anything(),
      '100 rs on North Plot',
      'test-model',
    );
  });

  it('clears the input after a successful entry', async () => {
    chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'test-model' });
    chatEntry.create.and.resolveTo(ACTIVITY);

    component.form.setValue({ text: '100 rs on North Plot' });
    await component.submit();

    expect(component.form.getRawValue().text).toBe('');
  });

  it('undo removes the activity and hides the card', async () => {
    chatEntry.parse.and.resolveTo({ parsed: entry(), model: 'test-model' });
    chatEntry.create.and.resolveTo(ACTIVITY);
    component.form.setValue({ text: '100 rs' });
    await component.submit();

    await component.undo();

    expect(chatEntry.undo).toHaveBeenCalledWith(99);
    expect(component.created()).toBeNull();
  });

  it('asks the farmer to rephrase when the text carried no activity', async () => {
    chatEntry.parse.and.rejectWith(new ChatEntryError('not-understood'));

    component.form.setValue({ text: 'hello there' });
    await component.submit();

    expect(component.notUnderstood()).toBeTrue();
    // Their words are kept so they can adjust rather than retype.
    expect(component.form.getRawValue().text).toBe('hello there');
    // Not an outage, so no error toast — that would misdescribe what happened.
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reports unavailability without creating anything', async () => {
    chatEntry.parse.and.rejectWith(new ChatEntryError('unavailable'));

    component.form.setValue({ text: '100 rs' });
    await component.submit();

    expect(toast.error).toHaveBeenCalled();
    expect(chatEntry.create).not.toHaveBeenCalled();
    expect(component.created()).toBeNull();
  });

  it('never leaves the form busy after a failure', async () => {
    chatEntry.parse.and.rejectWith(new ChatEntryError('unavailable'));

    component.form.setValue({ text: '100 rs' });
    await component.submit();

    expect(component.busy()).toBeFalse();
  });

  it('does not submit blank input', async () => {
    component.form.setValue({ text: '   ' });
    await component.submit();

    expect(chatEntry.parse).not.toHaveBeenCalled();
  });
});
