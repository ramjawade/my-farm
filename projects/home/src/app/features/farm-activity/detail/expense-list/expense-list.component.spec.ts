import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ExpenseListComponent } from './expense-list.component';
import { ActivityExpensesService } from '../activity-expenses.service';
import { ActivityExpense } from '../../../activity/activity.models';

describe('ExpenseListComponent', () => {
  let component: ExpenseListComponent;
  let fixture: ComponentFixture<ExpenseListComponent>;
  let getExpensesSpy: jasmine.Spy;
  let deleteExpenseSpy: jasmine.Spy;

  const mockExpense: ActivityExpense = {
    id: 1,
    activityId: 5,
    category: 'Seeds',
    amount: 500,
    createdAt: Date.now(),
  };

  beforeEach(async () => {
    getExpensesSpy = jasmine.createSpy('getExpenses').and.resolveTo([mockExpense]);
    deleteExpenseSpy = jasmine.createSpy('deleteExpense').and.resolveTo(undefined);

    await TestBed.configureTestingModule({
      imports: [ExpenseListComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ActivityExpensesService,
          useValue: { getExpenses: getExpensesSpy, deleteExpense: deleteExpenseSpy },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('activityId', 5);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads expenses for the given activity on init', () => {
    expect(getExpensesSpy).toHaveBeenCalledWith(5);
    expect(component.expenses()).toEqual([mockExpense]);
  });

  it('deletes an expense after confirmation and emits changed', async () => {
    const changedSpy = jasmine.createSpy('changed');
    component.changed.subscribe(changedSpy);

    component.deleteExpense(1);
    expect(component.showDeleteConfirm()).toBeTrue();

    await component.confirmDeleteExpense();

    expect(deleteExpenseSpy).toHaveBeenCalledWith(5, 1);
    expect(component.expenses()).toEqual([]);
    expect(changedSpy).toHaveBeenCalled();
  });

  it('shows an error state when loading fails', async () => {
    getExpensesSpy.and.rejectWith(new Error('network down'));
    await component.reload(5);

    expect(component.error()).toBe('Could not load expenses. Please try again.');
  });
});
