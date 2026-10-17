import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { PriceFigureComponent } from './price-figure.component';

describe('PriceFigureComponent', () => {
  let fixture: ComponentFixture<PriceFigureComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  function show(price: number, change?: number | null): void {
    fixture.componentRef.setInput('price', price);
    fixture.componentRef.setInput('change', change);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PriceFigureComponent],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideTranslateService()],
    });
    fixture = TestBed.createComponent(PriceFigureComponent);
  });

  it('shows the price in rupees with Indian grouping', () => {
    show(125000);
    expect(el().textContent).toContain('₹1,25,000');
  });

  it('shows a rise in green with a plus sign', () => {
    show(2150, 6.4);
    const small = el().querySelector('small.text-success');
    expect(small?.textContent).toContain('+6.4%');
  });

  it('shows a fall in red with a minus sign', () => {
    show(2150, -1.5);
    const small = el().querySelector('small.text-danger');
    expect(small?.textContent).toContain('−1.5%');
  });

  it('says "No change" for zero', () => {
    show(2150, 0);
    expect(el().textContent).toContain('prices.noChange');
  });

  it('shows no change line without a previous reading', () => {
    show(2150, null);
    expect(el().querySelector('small')).toBeNull();
  });
});
