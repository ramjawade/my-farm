import { Pipe, PipeTransform } from '@angular/core';

/** Formats a number as Indian rupees with Indian digit grouping, e.g. ₹1,23,450. */
@Pipe({ name: 'inr', standalone: true })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined, digits = 0): string {
    if (value === null || value === undefined || isNaN(value)) return '₹0';
    return `₹${value.toLocaleString('en-IN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`;
  }
}
