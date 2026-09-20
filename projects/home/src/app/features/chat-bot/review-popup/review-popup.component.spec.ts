import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../core/auth/auth.service';
import { ChatEntryService, ResolvedEntry } from '../../../core/api/chat-entry.service';
import { CropsApiService } from '../../../core/api/crops-api.service';
import { LandsApiService } from '../../../core/api/lands-api.service';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { Activity } from '../../activity/activity.models';
import { ReviewPopupComponent } from './review-popup.component';

function entry(overrides: Partial<ResolvedEntry> = {}): ResolvedEntry {
  return {
    transcript: '100 rs fertilizer',
    activity_type_id: 1,
    activity_type: 'Fertilizer Application',
    date: '2026-09-20',
    crop_id: 1,
    crop: 'Wheat',
    land_id: 1,
    land: 'North Plot',
    notes: null,
    expenses: [
      {
        expense_category_id: 4,
        category: 'Fertilizer',
        quantity: null,
        unit: null,
        rate: null,
        amount: '100',
        remarks: null,
      },
    ],
    dropped: [],
    ...overrides,
  };
}

const mockActivity: Activity = {
  id: 42,
  type: 'Fertilizer Application',
  status: 'Completed',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('ReviewPopupComponent', () => {
  let fixture: ComponentFixture<ReviewPopupComponent>;
  let component: ReviewPopupComponent;
  let chatEntry: jasmine.SpyObj<ChatEntryService>;
  let referenceData: jasmine.SpyObj<ReferenceDataService>;
  let lands: jasmine.SpyObj<LandsApiService>;
  let crops: jasmine.SpyObj<CropsApiService>;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    chatEntry = jasmine.createSpyObj('ChatEntryService', ['create']);
    referenceData = jasmine.createSpyObj('ReferenceDataService', ['listActivityTypes']);
    lands = jasmine.createSpyObj('LandsApiService', ['getFarms']);
    crops = jasmine.createSpyObj('CropsApiService', ['getCrops']);
    auth = jasmine.createSpyObj('AuthService', ['currentUser']);

    referenceData.listActivityTypes.and.resolveTo([
      { id: 1, name: 'Fertilizer Application' },
      { id: 2, name: 'Irrigation' },
    ]);
    lands.getFarms.and.resolveTo([{ id: 1, name: 'North Plot' }] as never);
    crops.getCrops.and.resolveTo([{ id: 1, name: 'Wheat' }] as never);
    auth.currentUser.and.returnValue({ id: 7 } as never);

    await TestBed.configureTestingModule({
      imports: [ReviewPopupComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideTranslateService(),
        { provide: ChatEntryService, useValue: chatEntry },
        { provide: ReferenceDataService, useValue: referenceData },
        { provide: LandsApiService, useValue: lands },
        { provide: CropsApiService, useValue: crops },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReviewPopupComponent);
    component = fixture.componentInstance;
  });

  it('renders nothing when there is no entry to review', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.review-popup-card')).toBeNull();
  });

  it('populates the form from the entry once one is provided', async () => {
    fixture.componentRef.setInput('entry', entry());
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.form.controls.activityType.value).toBe('Fertilizer Application');
    expect(component.form.controls.date.value).toBe('2026-09-20');
    expect(component.form.controls.landId.value).toBe(1);
    expect(component.form.controls.cropId.value).toBe(1);
    expect(component.expensesArray.length).toBe(1);
    expect(component.expensesArray.at(0).value).toEqual({ category: 'Fertilizer', amount: '100' });
  });

  it('calls create() with the edited entry and emits saved on Save', async () => {
    fixture.componentRef.setInput('entry', entry());
    fixture.componentRef.setInput('originalInput', '100 rs fertilizer on north plot');
    fixture.componentRef.setInput('model', 'gemini-3.1-flash-lite');
    fixture.detectChanges();
    await fixture.whenStable();

    chatEntry.create.and.resolveTo(mockActivity);
    component.form.controls.date.setValue('2026-09-21');
    component.expensesArray.at(0).controls.amount.setValue('150');

    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);

    await component.save();

    expect(chatEntry.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ date: '2026-09-21', land_id: 1, crop_id: 1 }),
      '100 rs fertilizer on north plot',
      'gemini-3.1-flash-lite',
    );
    const createdEntry = chatEntry.create.calls.argsFor(0)[0] as ResolvedEntry;
    expect(createdEntry.expenses[0].amount).toBe('150');
    expect(saved).toHaveBeenCalledWith(mockActivity);
  });

  it('emits cancelled and never calls create() on Cancel', () => {
    fixture.componentRef.setInput('entry', entry());
    fixture.detectChanges();

    const cancelled = jasmine.createSpy('cancelled');
    component.cancelled.subscribe(cancelled);

    component.cancel();

    expect(cancelled).toHaveBeenCalled();
    expect(chatEntry.create).not.toHaveBeenCalled();
  });

  it('shows an error and does not emit saved when create() fails', async () => {
    fixture.componentRef.setInput('entry', entry());
    fixture.detectChanges();
    await fixture.whenStable();

    chatEntry.create.and.rejectWith(new Error('network'));
    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);

    await component.save();

    expect(saved).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBeTruthy();
    expect(component.saving()).toBeFalse();
  });
});
