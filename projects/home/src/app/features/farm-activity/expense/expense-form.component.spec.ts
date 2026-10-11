import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { FakeReferenceDataService } from '../../../testing/fake-reference-data.service';
import { Activity, ActivityExpense } from '../../activity/activity.models';
import { ActivityService } from '../../activity/activity.service';
import { ActivityExpensesService } from '../detail/activity-expenses.service';
import { ExpenseFormComponent } from './expense-form.component';

describe('ExpenseFormComponent', () => {
  let addExpense: jasmine.Spy;
  let saveExpenseChanges: jasmine.Spy;
  let getExpenses: jasmine.Spy;
  let router: Router;

  const activities = [
    { id: 4, activityTypeId: 2, status: 'Completed', date: Date.now() } as Activity,
    { id: 5, activityTypeId: 2, status: 'Scheduled', date: Date.now() + 1000 } as Activity,
  ];
  const saved = {
    id: 9,
    activityId: 4,
    expenseCategoryId: 2,
    amount: 1000,
    quantity: 2,
    rate: 400,
    unit: 'bags',
    itemId: 'NPK',
    createdAt: 0,
  } as ActivityExpense;

  function setup(opts: { params?: Record<string, string>; query?: Record<string, string> } = {}) {
    TestBed.configureTestingModule({
      imports: [ExpenseFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        provideTranslateService(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(opts.params ?? {}),
              queryParamMap: convertToParamMap(opts.query ?? {}),
            },
          },
        },
        {
          provide: ActivityService,
          useValue: { activities: signal(activities), addExpense, saveExpenseChanges },
        },
        { provide: ActivityExpensesService, useValue: { getExpenses } },
        { provide: ReferenceDataService, useClass: FakeReferenceDataService },
        { provide: FarmDrawService, useValue: { loadFarms: () => Promise.resolve([]) } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        {
          provide: ToastService,
          useValue: { success: () => {}, error: jasmine.createSpy('error') },
        },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      el: fixture.nativeElement as HTMLElement,
    };
  }

  beforeEach(() => {
    addExpense = jasmine.createSpy('addExpense').and.resolveTo(saved);
    saveExpenseChanges = jasmine.createSpy('saveExpenseChanges').and.resolveTo();
    getExpenses = jasmine.createSpy('getExpenses').and.resolveTo([saved]);
  });

  it('shows the add form with the activity chosen from the link', async () => {
    const { fixture, component, el } = setup({ query: { activityId: '4' } });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('expenseForm.addTitle');
    expect(component.form.get('activityId')?.value).toBe(4);
    expect(component.form.get('expenseCategoryId')?.value).toBeNull();
    expect(component.activityOptions().length).toBe(2);
  });

  it('refuses an empty form and shows the three errors', async () => {
    const { fixture, component, el } = setup();
    await component.submit();
    fixture.detectChanges();

    expect(addExpense).not.toHaveBeenCalled();
    expect(el.textContent).toContain('expenseForm.activityRequired');
    expect(el.textContent).toContain('expenseForm.categoryRequired');
    expect(el.textContent).toContain('expenseForm.amountRequired');
  });

  it('refuses a zero amount', async () => {
    const { component } = setup({ query: { activityId: '4' } });
    component.form.patchValue({ expenseCategoryId: 2, amount: 0 });
    await component.submit();

    expect(addExpense).not.toHaveBeenCalled();
    expect(component.form.get('amount')?.invalid).toBeTrue();
  });

  it('works the amount out from quantity and rate, and lets it be typed over', () => {
    const { component } = setup();
    component.form.patchValue({ quantity: 3, rate: 500 });
    expect(component.form.get('amount')?.value).toBe(1500);

    component.form.patchValue({ amount: 1400 }, { emitEvent: false });
    expect(component.form.get('amount')?.value).toBe(1400);
  });

  it('saves a new expense and returns to the activity', async () => {
    const { component } = setup({ query: { activityId: '4' } });
    component.form.patchValue({ expenseCategoryId: 2, amount: 1200, itemId: ' NPK ' });
    await component.submit();

    expect(addExpense).toHaveBeenCalledWith(
      jasmine.objectContaining({
        activityId: 4,
        expenseCategoryId: 2,
        amount: 1200,
        itemId: 'NPK',
      }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/activities', 4]);
  });

  it('returns to the list when it was opened from there', async () => {
    const { component } = setup({ query: { from: 'list' } });
    component.form.patchValue({ activityId: 5, expenseCategoryId: 2, amount: 50 });
    await component.submit();

    expect(addExpense).toHaveBeenCalledWith(jasmine.objectContaining({ activityId: 5 }));
    expect(router.navigate).toHaveBeenCalledWith(['/activities/list']);
  });

  it('cancels without saving', () => {
    const { component } = setup({ query: { activityId: '4' } });
    component.cancel();

    expect(addExpense).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/activities', 4]);
  });

  it('stays on the form with an error when saving fails', async () => {
    addExpense.and.rejectWith(new Error('down'));
    const { component } = setup({ query: { activityId: '4' } });
    component.form.patchValue({ expenseCategoryId: 2, amount: 10 });
    await component.submit();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.form.get('amount')?.value).toBe(10);
    expect(component.saving()).toBeFalse();
  });

  describe('editing', () => {
    const params = { activityId: '4', expenseId: '9' };

    it('fills the saved values, keeps the saved amount and locks the activity', async () => {
      const { fixture, component, el } = setup({ params });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el.textContent).toContain('expenseForm.editTitle');
      expect(component.form.get('activityId')?.disabled).toBeTrue();
      expect(component.form.getRawValue()).toEqual(
        jasmine.objectContaining({
          activityId: 4,
          expenseCategoryId: 2,
          itemId: 'NPK',
          quantity: 2,
          rate: 400,
          amount: 1000,
        }),
      );
    });

    it('saves the change and returns to the activity', async () => {
      const { fixture, component } = setup({ params });
      await fixture.whenStable();
      component.form.patchValue({ amount: 1200 });
      await component.submit();

      expect(saveExpenseChanges).toHaveBeenCalledWith(
        9,
        jasmine.objectContaining({ amount: 1200, expenseCategoryId: 2 }),
      );
      expect(addExpense).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/activities', 4]);
    });
  });
});
