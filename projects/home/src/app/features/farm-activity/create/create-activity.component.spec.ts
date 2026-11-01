import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { CreateActivityComponent } from './create-activity.component';
import { ActivityService } from '../../activity/activity.service';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { AuthService } from '../../../core/auth/auth.service';
import { WorkflowStateService } from '../../../core/workflow/workflow-state.service';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { Activity } from '../../activity/activity.models';

describe('CreateActivityComponent', () => {
  let component: CreateActivityComponent;
  let fixture: ComponentFixture<CreateActivityComponent>;
  let addActivitySpy: jasmine.Spy;
  let updateActivitySpy: jasmine.Spy;
  let createActivityTypeSpy: jasmine.Spy;
  let queryParams: BehaviorSubject<Record<string, string>>;
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: Router;

  const mockNewActivity: Activity = {
    id: 42,
    activityTypeId: 2,
    status: 'Completed',
    date: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  function setup(): void {
    TestBed.configureTestingModule({
      imports: [CreateActivityComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { queryParams, paramMap } },
        {
          provide: ActivityService,
          useValue: {
            activities: signal([]),
            addActivity: addActivitySpy,
            updateActivity: updateActivitySpy,
          },
        },
        { provide: CropTimelineService, useValue: { crops: signal([]), activities: signal([]) } },
        { provide: FarmDrawService, useValue: { loadFarms: () => Promise.resolve([]) } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: WorkflowStateService, useValue: { markPhaseComplete: jasmine.createSpy() } },
        {
          provide: ReferenceDataService,
          useValue: {
            listActivityTypes: () => Promise.resolve([]),
            createActivityType: createActivityTypeSpy,
            activityTypeIdForName: () => Promise.resolve(2),
            activityTypeName: () => 'Irrigation',
            isActivityType: () => false,
          },
        },
      ],
    });

    fixture = TestBed.createComponent(CreateActivityComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  }

  beforeEach(() => {
    addActivitySpy = jasmine.createSpy('addActivity').and.resolveTo(mockNewActivity);
    updateActivitySpy = jasmine.createSpy('updateActivity');
    createActivityTypeSpy = jasmine
      .createSpy('createActivityType')
      .and.resolveTo({ id: 9, name: 'Mulching' });
    queryParams = new BehaviorSubject<Record<string, string>>({});
    paramMap = new BehaviorSubject(convertToParamMap({}));
  });

  it('should create the component', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('is not crop-scoped when no route cropId param is present', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isCropScoped()).toBeFalse();
  });

  it('resolves cropId from the route path param, taking priority over the query param', async () => {
    paramMap = new BehaviorSubject(convertToParamMap({ cropId: '5' }));
    queryParams = new BehaviorSubject<Record<string, string>>({ cropId: '99' });
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isCropScoped()).toBeTrue();
    expect(component.form.get('cropId')?.value).toBe(5);
  });

  it('pre-fills type/date/fieldId/notes from query params (the chat-bot escape hatch)', async () => {
    queryParams = new BehaviorSubject<Record<string, string>>({
      type: 'Fertilizer Application',
      date: '2026-09-20',
      fieldId: '7',
      notes: 'from the chat bot',
    });
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.form.get('type')?.value).toBe('Fertilizer Application');
    expect(component.form.get('date')?.value).toBe('2026-09-20');
    expect(component.form.get('fieldId')?.value).toBe(7);
    expect(component.form.get('notes')?.value).toBe('from the chat bot');
  });

  it('navigates to the global activity detail page after create when not crop-scoped', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.form.patchValue({ type: 'Irrigation', date: '2026-01-01' });
    await component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/activities', mockNewActivity.id]);
  });

  it('navigates back relatively after create when crop-scoped', async () => {
    paramMap = new BehaviorSubject(convertToParamMap({ cropId: '5' }));
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.form.patchValue({ type: 'Irrigation', date: '2026-01-01' });
    await component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['..'], { relativeTo: component['route'] });
  });

  it('navigates back relatively on cancel when crop-scoped', async () => {
    paramMap = new BehaviorSubject(convertToParamMap({ cropId: '5' }));
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.onCancel();

    expect(router.navigate).toHaveBeenCalledWith(['..'], { relativeTo: component['route'] });
  });

  it('navigates to the global activities list on cancel when not crop-scoped', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.onCancel();

    expect(router.navigate).toHaveBeenCalledWith(['/activities']);
  });

  it('shows the activity types as chips, Custom last, and selects one', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    component.referenceActivityTypes.set([
      { id: 3, name: 'Custom' },
      { id: 2, name: 'Irrigation' },
      { id: 1, name: 'Sowing' },
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const chips = Array.from(el.querySelectorAll<HTMLInputElement>('input[name="type"]'));
    expect(chips.map((c) => c.id)).toEqual(['type-1', 'type-2', 'type-3']);
    chips[1].click();
    expect(component.form.get('type')?.value).toBe('Irrigation');
  });

  it('saves a Custom activity under the typed name, creating that type', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.form.patchValue({ type: 'Custom', customName: 'Mulching' });
    await component.onSubmit();

    expect(createActivityTypeSpy).toHaveBeenCalledWith('Mulching');
    expect(addActivitySpy).toHaveBeenCalled();
  });

  it('refuses a Custom activity without a name', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.form.patchValue({ type: 'Custom', customName: '  ' });
    await component.onSubmit();

    expect(addActivitySpy).not.toHaveBeenCalled();
    expect(createActivityTypeSpy).not.toHaveBeenCalled();
  });

  it('offers all five statuses', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const values = Array.from(el.querySelectorAll<HTMLInputElement>('input[name="status"]')).map(
      (c) => c.id.replace('status-', ''),
    );
    expect(values).toEqual(['Draft', 'Scheduled', 'In Progress', 'Completed', 'Cancelled']);
  });

  it('sets the status from the date until the farmer picks one', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.form.patchValue({ date: '2999-01-01' });
    expect(component.form.get('status')?.value).toBe('Scheduled');
    component.form.patchValue({ date: '2001-01-01' });
    expect(component.form.get('status')?.value).toBe('Completed');

    component.form.patchValue({ status: 'In Progress' });
    component.onStatusPicked();
    component.form.patchValue({ date: '2999-01-01' });
    expect(component.form.get('status')?.value).toBe('In Progress');
  });

  describe('Sale details', () => {
    const saleBlock = () =>
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="sale-details"]');

    async function openSale(): Promise<void> {
      queryParams = new BehaviorSubject<Record<string, string>>({ type: 'Sale' });
      paramMap = new BehaviorSubject(convertToParamMap({ cropId: '5' }));
      setup();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('reveals the block for the Sale type and hides it for another type', async () => {
      await openSale();
      expect(saleBlock()).not.toBeNull();

      component.form.patchValue({ type: 'Irrigation' });
      fixture.detectChanges();
      expect(saleBlock()).toBeNull();
    });

    it('refuses a completed sale with no figures and shows the messages', async () => {
      await openSale();

      await component.onSubmit();
      fixture.detectChanges();

      expect(addActivitySpy).not.toHaveBeenCalled();
      expect(component.saleErrors()).toEqual({
        quantity: 'saleForm.quantityRequired',
        rate: 'saleForm.rateRequired',
        amount: 'saleForm.amountRequired',
      });
    });

    it('asks for a unit when only the quantity is filled', async () => {
      await openSale();
      component.form.patchValue({ saleQuantity: 5 });

      await component.onSubmit();

      expect(component.saleErrors().quantity).toBe('saleForm.unitRequired');
    });

    it('asks for the crop on a sale', async () => {
      queryParams = new BehaviorSubject<Record<string, string>>({ type: 'Sale' });
      setup();
      fixture.detectChanges();
      await fixture.whenStable();

      await component.onSubmit();

      expect(component.saleErrors().crop).toBe('createActivity.saleCropRequired');
      expect(addActivitySpy).not.toHaveBeenCalled();
    });

    it('works out the amount from quantity and rate, and keeps a typed amount', async () => {
      await openSale();

      component.form.patchValue({ saleQuantity: 10, saleRate: 1100 });
      expect(component.form.get('saleAmount')?.value).toBe(11000);

      component.onAmountInput();
      component.form.patchValue({ saleAmount: 10500 });
      component.form.patchValue({ saleQuantity: 12 });
      expect(component.form.get('saleAmount')?.value).toBe(10500);
    });

    it('saves a completed sale with its figures and returns to the crop page', async () => {
      await openSale();
      component.form.patchValue({
        saleQuantity: 12,
        saleUnit: 'crates',
        saleRate: 1250,
        saleBuyer: ' Nashik APMC ',
      });

      await component.onSubmit();

      const saved = addActivitySpy.calls.mostRecent().args[0];
      expect(saved.sale).toEqual({
        quantity: 12,
        unit: 'crates',
        rate: 1250,
        amount: 15000,
        buyer: 'Nashik APMC',
      });
      expect(saved.cropId).toBe(5);
      expect(router.navigate).toHaveBeenCalledWith(['..'], { relativeTo: component['route'] });
    });

    it('saves a planned sale without figures', async () => {
      await openSale();
      component.form.patchValue({ date: '2999-01-01' });
      expect(component.form.get('status')?.value).toBe('Scheduled');

      await component.onSubmit();

      const saved = addActivitySpy.calls.mostRecent().args[0];
      expect(saved.status).toBe('Scheduled');
      expect(saved.sale).toEqual({
        quantity: undefined,
        unit: undefined,
        rate: undefined,
        amount: undefined,
        buyer: undefined,
      });
    });

    it('drops the figures when the type is changed away from Sale', async () => {
      await openSale();
      component.form.patchValue({ saleQuantity: 1, saleUnit: 'kg', saleRate: 10 });
      component.form.patchValue({ type: 'Irrigation' });

      await component.onSubmit();

      expect(addActivitySpy.calls.mostRecent().args[0].sale).toBeUndefined();
    });
  });
});
