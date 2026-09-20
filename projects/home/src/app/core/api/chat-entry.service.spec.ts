import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ActivityService } from '../../features/activity/activity.service';
import { Activity } from '../../features/activity/activity.models';
import { HttpService } from '../http/http.service';
import { ChatEntryProvenance, ChatEntryService, ResolvedEntry } from './chat-entry.service';

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

describe('ChatEntryService', () => {
  let service: ChatEntryService;
  let activities: jasmine.SpyObj<ActivityService>;

  beforeEach(() => {
    activities = jasmine.createSpyObj<ActivityService>('ActivityService', [
      'addActivity',
      'addExpense',
      'deleteActivity',
    ]);
    activities.addActivity.and.resolveTo({ id: 7 } as Activity);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: HttpService, useValue: jasmine.createSpyObj('HttpService', ['post']) },
        { provide: ActivityService, useValue: activities },
      ],
    });
    service = TestBed.inject(ChatEntryService);
  });

  function provenanceOf(): ChatEntryProvenance {
    const draft = activities.addActivity.calls.mostRecent().args[0];
    return draft.metadata as unknown as ChatEntryProvenance;
  }

  it('records what the farmer typed and which model read it', async () => {
    await service.create(entry(), '100 rs on North Plot', 'test-model');

    const meta = provenanceOf();
    expect(meta.source).toBe('text');
    expect(meta.input).toBe('100 rs on North Plot');
    expect(meta.model).toBe('test-model');
  });

  it('snapshots what the model proposed, so later edits are recoverable as corrections', async () => {
    await service.create(entry({ land_id: 22, date: '2026-09-20' }), 'typed', 'test-model');

    const meta = provenanceOf();
    // The row itself is what the farmer accepted; this snapshot is what was
    // proposed. The difference between them IS the correction (#244).
    expect(meta.parsed.land_id).toBe(22);
    expect(meta.parsed.date).toBe('2026-09-20');
    expect(meta.parsed.activity_type).toBe('Maintenance');
  });

  it('records fields the backend refused, with the reason', async () => {
    const dropped = [{ field: 'crop', value: 'kapas', reason: 'not_found' as const }];
    await service.create(entry({ dropped }), 'typed', 'test-model');

    expect(provenanceOf().dropped).toEqual(dropped);
  });

  it('uses the ids resolved by the backend without re-resolving them', async () => {
    await service.create(entry({ crop_id: 30, land_id: 22 }), 'typed', 'test-model');

    const draft = activities.addActivity.calls.mostRecent().args[0];
    expect(draft.cropId).toBe(30);
    expect(draft.fieldId).toBe(22);
  });

  it('skips an expense line carrying no amount', async () => {
    await service.create(
      entry({
        expenses: [
          {
            expense_category_id: null,
            category: 'Fertilizer',
            quantity: null,
            unit: null,
            rate: null,
            amount: null,
            remarks: null,
          },
        ],
      }),
      'typed',
      'test-model',
    );

    expect(activities.addExpense).not.toHaveBeenCalled();
  });

  it('undo deletes the activity', () => {
    service.undo(7);
    expect(activities.deleteActivity).toHaveBeenCalledWith(7);
  });
});
