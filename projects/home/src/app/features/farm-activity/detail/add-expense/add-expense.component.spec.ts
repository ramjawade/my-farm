import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AddExpenseComponent } from './add-expense.component';
import { ActivityExpensesService } from '../activity-expenses.service';
import { ReferenceDataService } from '../../../../core/api/reference-data.service';
import { ActivityExpense } from '../../../activity/activity.models';

describe('AddExpenseComponent', () => {
  let component: AddExpenseComponent;
  let fixture: ComponentFixture<AddExpenseComponent>;
  let addExpenseSpy: jasmine.Spy;
  let listExpenseCategoriesSpy: jasmine.Spy;

  const mockExpense: ActivityExpense = {
    id: 1,
    activityId: 5,
    category: 'Seeds',
    amount: 500,
    createdAt: Date.now(),
  };

  beforeEach(async () => {
    addExpenseSpy = jasmine.createSpy('addExpense').and.resolveTo(mockExpense);
    listExpenseCategoriesSpy = jasmine.createSpy('listExpenseCategories').and.resolveTo([
      { id: 2, name: 'Labour' },
      { id: 3, name: 'Seeds' },
    ]);

    await TestBed.configureTestingModule({
      imports: [AddExpenseComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivityExpensesService, useValue: { addExpense: addExpenseSpy } },
        {
          provide: ReferenceDataService,
          useValue: { listExpenseCategories: listExpenseCategoriesSpy },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddExpenseComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('activityId', 5);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads real categories from the reference table on init', () => {
    expect(listExpenseCategoriesSpy).toHaveBeenCalled();
    expect(component.categoriesList()).toEqual(['Labour', 'Seeds']);
    expect(component.expenseForm.get('category')?.value).toBe('Labour');
  });

  it('does not submit an invalid form', async () => {
    component.expenseForm.patchValue({ amount: null });
    await component.submit();

    expect(addExpenseSpy).not.toHaveBeenCalled();
  });

  it('adds an expense and emits added on success', async () => {
    const addedSpy = jasmine.createSpy('added');
    component.added.subscribe(addedSpy);

    component.expenseForm.patchValue({ category: 'Seeds', amount: 500 });
    await component.submit();

    expect(addExpenseSpy).toHaveBeenCalledWith(5, jasmine.objectContaining({ amount: 500 }));
    expect(addedSpy).toHaveBeenCalledWith(mockExpense);
  });

  it('emits cancelled and resets the form', () => {
    const cancelledSpy = jasmine.createSpy('cancelled');
    component.cancelled.subscribe(cancelledSpy);

    component.expenseForm.patchValue({ amount: 999 });
    component.cancel();

    expect(cancelledSpy).toHaveBeenCalled();
    expect(component.expenseForm.get('amount')?.value).toBeNull();
  });
});
