import { Pipe, PipeTransform } from '@angular/core';

export type AreaUnit = 'acres' | 'hectares';

const SQM_PER_HECTARE = 10_000;
const SQM_PER_ACRE = 4046.8564224;

export function toSquareMeters(value: number, unit: AreaUnit): number {
  return unit === 'acres' ? value * SQM_PER_ACRE : value * SQM_PER_HECTARE;
}

export function fromSquareMeters(sqm: number, unit: AreaUnit): number {
  return unit === 'acres' ? sqm / SQM_PER_ACRE : sqm / SQM_PER_HECTARE;
}

export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  if (from === to) return value;
  return fromSquareMeters(toSquareMeters(value, from), to);
}

export function unitLabel(unit: AreaUnit): string {
  return unit === 'acres' ? 'ac' : 'ha';
}

/**
 * Formats an area in the viewer's preferred unit.
 * Usage: {{ crop.area | area: crop.areaUnit : preferredUnit }}
 * Output e.g. "2.5 ha" or "6.18 ac".
 */
@Pipe({ name: 'area', standalone: true })
export class AreaPipe implements PipeTransform {
  transform(
    value: number | null | undefined,
    from: AreaUnit = 'hectares',
    to: AreaUnit = from,
    digits = 2,
  ): string {
    if (value === null || value === undefined || isNaN(value)) return '—';
    const converted = convertArea(value, from, to);
    const rounded = Math.round(converted * 10 ** digits) / 10 ** digits;
    return `${rounded.toLocaleString('en-IN', { maximumFractionDigits: digits })} ${unitLabel(to)}`;
  }
}
