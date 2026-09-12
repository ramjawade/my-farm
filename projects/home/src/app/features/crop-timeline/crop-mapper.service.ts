import { Injectable, inject } from '@angular/core';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { CropEntity, CropStage, CropStatus, NewCrop } from './crop-timeline.models';

function dateStringToTimestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

function timestampToDateString(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeCropStatus(status: unknown): CropStatus {
  return status === 'Completed' || status === 'Archived' ? status : 'Active';
}

/**
 * Shared crop wire-format mapping — `crop_catalog_id` (backend FK) versus
 * `cropType` (frontend free text) needs `ReferenceDataService`, so this
 * can't be a plain pure function. Used by every crop-timeline service that
 * talks to `/api/v1/crops` directly (dashboard, add-crop, ...), so it lives
 * here instead of duplicated per service.
 */
@Injectable({ providedIn: 'root' })
export class CropMapperService {
  private readonly referenceData = inject(ReferenceDataService);

  async fromBackend(item: any): Promise<CropEntity> {
    return {
      id: item.id,
      fieldId: item.land_id,
      name: item.label ?? '',
      // TODO: use crop_catalog_id directly instead of resolving to cropType name.
      cropType: await this.referenceData.cropNameForId(item.crop_catalog_id),
      area: item.area !== null && item.area !== undefined ? Number(item.area) : 0,
      areaUnit: item.area_unit === 'hectares' ? 'hectares' : 'acres',
      season: item.season ?? undefined,
      sowingDate: dateStringToTimestamp(item.sowing_date),
      currentStage: (item.current_stage ?? 'Land Preparation') as CropStage,
      status: normalizeCropStatus(item.status),
      expectedHarvestDate: dateStringToTimestamp(item.expected_harvest_date),
    };
  }

  async toBackend(crop: Partial<NewCrop> | Partial<CropEntity>): Promise<Record<string, unknown>> {
    return {
      land_id: crop.fieldId,
      crop_catalog_id:
        crop.cropType !== undefined
          ? await this.referenceData.cropCatalogIdForName(crop.cropType)
          : undefined,
      label: crop.name,
      area: crop.area,
      area_unit: crop.areaUnit,
      season: crop.season,
      sowing_date: timestampToDateString(crop.sowingDate),
      current_stage: crop.currentStage,
      status: crop.status,
      expected_harvest_date: timestampToDateString(crop.expectedHarvestDate),
    };
  }
}
