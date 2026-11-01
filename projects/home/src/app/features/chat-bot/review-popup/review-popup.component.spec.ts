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
  activityTypeId: 3,
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

  describe('a sale', () => {
    const saleEntry = (over: Partial<ResolvedEntry> = {}): ResolvedEntry =>
      entry({
        activity_type_id: 9,
        activity_type: 'Sale',
        date: '2026-09-20',
        expenses: [],
        sale_quantity: '12',
        sale_unit: 'crates',
        sale_rate: '1250',
        sale_amount: null,
        sale_buyer: null,
        ...over,
      });

    const saleBlock = () =>
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="sale-details"]');

    async function open(over: Partial<ResolvedEntry> = {}): Promise<void> {
      fixture.componentRef.setInput('entry', saleEntry(over));
      fixture.componentRef.setInput('originalInput', 'sold 12 crates at 1250');
      fixture.componentRef.setInput('model', 'test-model');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      chatEntry.create.and.resolveTo(mockActivity);
    }

    const created = () => chatEntry.create.calls.argsFor(0)[0] as ResolvedEntry;

    it('shows the Sale details prefilled, with the amount worked out', async () => {
      await open();

      expect(saleBlock()).not.toBeNull();
      expect(component.form.controls.saleQuantity.value).toBe(12);
      expect(component.form.controls.saleUnit.value).toBe('crates');
      expect(component.form.controls.saleRate.value).toBe(1250);
      expect(component.form.controls.saleAmount.value).toBe(15000);
    });

    it('keeps a stated total and works the rate out from it', async () => {
      await open({ sale_rate: null, sale_amount: '15000' });

      expect(component.form.controls.saleAmount.value).toBe(15000);
      expect(component.form.controls.saleRate.value).toBe(1250);
    });

    it('recalculates the amount until the farmer types their own', async () => {
      await open();

      component.form.controls.saleQuantity.setValue(10);
      expect(component.form.controls.saleAmount.value).toBe(12500);

      component.onAmountInput();
      component.form.controls.saleAmount.setValue(12000);
      component.form.controls.saleQuantity.setValue(20);
      expect(component.form.controls.saleAmount.value).toBe(12000);
    });

    it('saves the figures as strings with the reviewed entry', async () => {
      await open();
      component.form.controls.saleBuyer.setValue(' Patil Traders ');

      await component.save();

      expect(created()).toEqual(
        jasmine.objectContaining({
          activity_type: 'Sale',
          sale_quantity: '12',
          sale_unit: 'crates',
          sale_rate: '1250',
          sale_amount: '15000',
          sale_buyer: 'Patil Traders',
        }),
      );
    });

    it('refuses to save without a quantity and shows the message', async () => {
      await open();
      component.form.controls.saleQuantity.setValue(null);

      await component.save();
      fixture.detectChanges();

      expect(chatEntry.create).not.toHaveBeenCalled();
      expect(component.saleErrors().quantity).toBe('saleForm.quantityRequired');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'saleForm.quantityRequired',
      );
    });

    it('asks for a unit when only the quantity is filled', async () => {
      await open();
      component.form.controls.saleUnit.setValue('  ');

      await component.save();

      expect(component.saleErrors().quantity).toBe('saleForm.unitRequired');
    });

    it('refuses a missing rate and a missing amount', async () => {
      await open();
      component.form.controls.saleRate.setValue(null);
      component.onAmountInput();
      component.form.controls.saleAmount.setValue(null);

      await component.save();

      expect(component.saleErrors()).toEqual({
        rate: 'saleForm.rateRequired',
        amount: 'saleForm.amountRequired',
      });
      expect(chatEntry.create).not.toHaveBeenCalled();
    });

    it('requires a crop', async () => {
      await open({ crop_id: null, crop: null });

      await component.save();

      expect(component.saleErrors().crop).toBe('createActivity.saleCropRequired');
      expect(chatEntry.create).not.toHaveBeenCalled();
    });

    it('refuses a date after today', async () => {
      await open();
      component.form.controls.date.setValue('2999-01-01');

      await component.save();

      expect(component.saleErrors().date).toBe('chatBot.review.saleDateFuture');
      expect(chatEntry.create).not.toHaveBeenCalled();
    });

    it('clears an error once the farmer fixes it', async () => {
      await open();
      component.form.controls.saleQuantity.setValue(null);
      await component.save();
      expect(component.saleErrors().quantity).toBeDefined();

      component.form.controls.saleQuantity.setValue(5);

      expect(component.saleErrors().quantity).toBeUndefined();
    });

    it('hides the block and sends no figures when the type changes to another activity', async () => {
      await open();

      component.form.controls.activityType.setValue('Irrigation');
      fixture.detectChanges();
      expect(saleBlock()).toBeNull();

      await component.save();

      expect(chatEntry.create).toHaveBeenCalled();
      expect(created()).toEqual(
        jasmine.objectContaining({
          activity_type: 'Irrigation',
          sale_quantity: null,
          sale_unit: null,
          sale_rate: null,
          sale_amount: null,
          sale_buyer: null,
        }),
      );
    });

    it('shows no Sale details and asks nothing sale-related for another kind of entry', async () => {
      fixture.componentRef.setInput('entry', entry());
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      chatEntry.create.and.resolveTo(mockActivity);

      expect(saleBlock()).toBeNull();
      await component.save();

      expect(chatEntry.create).toHaveBeenCalled();
      expect(component.saleErrors()).toEqual({});
    });
  });
});
