import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { CropTimelineService } from '../crop-timeline.service';
import { CropSale } from './crop-sale.models';
import { CropSalesService } from './crop-sales.service';
import { SaleFormComponent } from './sale-form.component';

describe('SaleFormComponent', () => {
  let add: jasmine.Spy;
  let update: jasmine.Spy;
  let list: jasmine.Spy;
  let router: Router;

  const saved: CropSale = {
    id: 9,
    cropId: 3,
    soldOn: '2026-10-02',
    quantity: 12,
    unit: 'crates',
    rate: 1250,
    amount: 15000,
    buyer: 'Nashik APMC',
  };

  function setup(params: Record<string, string> = { cropId: '3' }) {
    TestBed.configureTestingModule({
      imports: [SaleFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        provideTranslateService(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(params) } },
        },
        { provide: CropSalesService, useValue: { add, update, list } },
        {
          provide: CropTimelineService,
          useValue: {
            getCropById: () => ({ id: 3, name: 'Tomato' }),
            reload: () => Promise.resolve(),
          },
        },
        { provide: ToastService, useValue: { success: () => {}, error: () => {} } },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(SaleFormComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      el: fixture.nativeElement as HTMLElement,
    };
  }

  beforeEach(() => {
    add = jasmine.createSpy('add').and.resolveTo(saved);
    update = jasmine.createSpy('update').and.resolveTo(saved);
    list = jasmine.createSpy('list').and.resolveTo([saved]);
  });

  it('refuses an empty form and shows the errors', async () => {
    const { fixture, component, el } = setup();
    await component.submit();
    fixture.detectChanges();

    expect(add).not.toHaveBeenCalled();
    expect(el.textContent).toContain('saleForm.quantityRequired');
    expect(el.textContent).toContain('saleForm.rateRequired');
    expect(el.textContent).toContain('saleForm.amountRequired');
  });

  it('asks for a unit when only the unit is missing', async () => {
    const { fixture, component, el } = setup();
    component.form.patchValue({ quantity: 2, rate: 100, unit: '' });
    await component.submit();
    fixture.detectChanges();

    expect(add).not.toHaveBeenCalled();
    expect(el.textContent).toContain('saleForm.unitRequired');
  });

  it('works the amount out from quantity and rate, and lets it be typed over', () => {
    const { component } = setup();
    component.form.patchValue({ quantity: 10, rate: 1100 });
    expect(component.form.get('amount')?.value).toBe(11000);

    component.form.patchValue({ amount: 10500 }, { emitEvent: false });
    expect(component.form.get('amount')?.value).toBe(10500);
  });

  it('saves a new sale and returns to the crop', async () => {
    const { component } = setup();
    component.form.patchValue({ quantity: 12, unit: ' crates ', rate: 1250, buyer: ' Patil ' });
    await component.submit();

    expect(add).toHaveBeenCalledWith(
      3,
      jasmine.objectContaining({ quantity: 12, unit: 'crates', amount: 15000, buyer: 'Patil' }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/crops', 3]);
  });

  it('fills the saved values when editing and saves changes', async () => {
    const { fixture, component } = setup({ cropId: '3', saleId: '9' });
    await fixture.whenStable();

    expect(component.isEdit()).toBeTrue();
    expect(component.form.get('amount')?.value).toBe(15000);

    component.form.patchValue({ amount: 15500 }, { emitEvent: false });
    await component.submit();
    expect(update).toHaveBeenCalledWith(3, 9, jasmine.objectContaining({ amount: 15500 }));
  });

  it('stays on the form when saving fails', async () => {
    add.and.rejectWith(new Error('boom'));
    const { component } = setup();
    component.form.patchValue({ quantity: 1, unit: 'kg', rate: 10 });
    await component.submit();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.form.get('quantity')?.value).toBe(1);
  });
});
