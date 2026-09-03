import { Activity, ActivityExpense, ActivityType } from '../../features/activity/activity.models';
import {
  CropEntity,
  CropStage,
  CROP_STAGES,
} from '../../features/crop-timeline/crop-timeline.models';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { LatLngPoint, SavedFarm } from '../../map/models/map.models';
import { calculateFarmArea, toGeoJsonPolygon } from '../../map/farm-draw/farm-area.utils';

/**
 * The one demo farm. Every seeded record below belongs to this farmer so the
 * dashboard, lands, crops, activities and reports all tell the same story.
 */
export const DEMO_USER_ID = 'f-default';

const ONE_DAY = 24 * 60 * 60 * 1000;

const STAGE_OFFSET_DAYS: Record<CropStage, number> = {
  'Land Preparation': -5,
  Sowing: 0,
  Germination: 7,
  'Vegetative Growth': 21,
  Flowering: 45,
  'Fruiting / Pod Formation': 60,
  Maturity: 90,
  Harvest: 100,
};

export const DEMO_FARMER: FarmerRegistrationData = {
  id: DEMO_USER_ID,
  fullName: 'Ram Jawade',
  phone: '9876543210',
  email: 'ram.jawade@myfarm.com',
  preferredLanguage: 'English',
  userRole: 'Farmer',
  farmName: "Ram's Organic Farm",
  farmArea: 7,
  farmAreaUnit: 'hectares',
  primaryCrops: ['Soybeans', 'Wheat'],
  waterSource: 'Borewell',
  irrigationType: 'Drip',
  farmingMethod: 'Organic',
  locationType: 'map',
  state: 'Maharashtra',
  district: 'Pune',
  village: 'Khed Shivapur',
  pincode: '412205',
  location: { lat: 18.3935, lng: 73.8412 },
  createdAt: Date.UTC(2025, 5, 1),
  farmSetupCompleted: true,
};

function rect(lat: number, lng: number, dLat: number, dLng: number): LatLngPoint[] {
  return [
    { lat, lng },
    { lat, lng: lng + dLng },
    { lat: lat + dLat, lng: lng + dLng },
    { lat: lat + dLat, lng },
  ];
}

function farm(id: string, name: string, points: LatLngPoint[], createdAt: number): SavedFarm {
  const area = calculateFarmArea(points) ?? { squareMeters: 0, hectares: 0, acres: 0 };
  return { id, name, points, area, geoJson: toGeoJsonPolygon(points), createdAt };
}

export interface DemoDataset {
  farms: SavedFarm[];
  crops: CropEntity[];
  activities: Activity[];
  expenses: ActivityExpense[];
}

interface WorkItem {
  id: string;
  cropId: string;
  parentActivityId?: string;
  type: ActivityType;
  daysFromNow: number;
  status: Activity['status'];
  notes: string;
  metadata?: Activity['metadata'];
  expenses?: {
    category: string;
    amount: number;
    quantity?: number;
    unit?: string;
    rate?: number;
  }[];
}

/** Build the dataset relative to `now` so dates always look current. */
export function buildDemoDataset(now: number = Date.now()): DemoDataset {
  const farms: SavedFarm[] = [
    farm(
      'demo-land-north',
      'North Plot',
      rect(18.3952, 73.8395, 0.0014, 0.0017),
      now - 120 * ONE_DAY,
    ),
    farm(
      'demo-land-river',
      'River Side Plot',
      rect(18.3918, 73.8418, 0.0019, 0.0024),
      now - 110 * ONE_DAY,
    ),
  ];

  const sowingSoy = now - 65 * ONE_DAY;
  const sowingWheat = now - 15 * ONE_DAY;

  const crops: CropEntity[] = [
    {
      id: 'demo-crop-soybean',
      fieldId: 'demo-land-north',
      name: 'Soybean (JS-335)',
      cropType: 'Soybeans',
      area: 2.4,
      areaUnit: 'hectares',
      season: 'Kharif',
      sowingDate: sowingSoy,
      currentStage: 'Flowering',
      status: 'Active',
      expectedHarvestDate: sowingSoy + 100 * ONE_DAY,
    },
    {
      id: 'demo-crop-wheat',
      fieldId: 'demo-land-river',
      name: 'Wheat (HD-2967)',
      cropType: 'Wheat',
      area: 4.6,
      areaUnit: 'hectares',
      season: 'Rabi',
      sowingDate: sowingWheat,
      currentStage: 'Germination',
      status: 'Active',
      expectedHarvestDate: sowingWheat + 100 * ONE_DAY,
    },
  ];

  const activities: Activity[] = [];
  const expenses: ActivityExpense[] = [];

  const push = (a: Activity) => activities.push(a);

  // Lifecycle stage markers (one per stage per crop)
  for (const crop of crops) {
    const currentIdx = CROP_STAGES.indexOf(crop.currentStage);
    CROP_STAGES.forEach((stage, idx) => {
      const reached = idx <= currentIdx;
      const date = crop.sowingDate! + STAGE_OFFSET_DAYS[stage] * ONE_DAY;
      push({
        id: `${crop.id}-stage-${idx}`,
        cropId: crop.id,
        fieldId: crop.fieldId,
        type: stage === 'Sowing' ? 'Sowing' : stage === 'Harvest' ? 'Harvest' : 'Field Inspection',
        date: reached ? date : undefined,
        season: crop.season,
        status: reached ? 'Completed' : 'Scheduled',
        notes: `Growth stage advanced to: ${stage}.`,
        attachments: [],
        metadata: {},
        createdAt: date,
        updatedAt: date,
      });
    });
  }

  const soy = 'demo-crop-soybean';
  const wheat = 'demo-crop-wheat';
  const work: WorkItem[] = [
    {
      id: 'demo-act-soy-sowing',
      cropId: soy,
      type: 'Sowing',
      daysFromNow: -65,
      status: 'Completed',
      notes: 'Sown with a tractor-drawn seed drill at 45 cm spacing after first monsoon showers.',
      expenses: [
        { category: 'Seeds', amount: 4500, quantity: 60, unit: 'kg', rate: 75 },
        { category: 'Machine Rent', amount: 1800, quantity: 3, unit: 'hours', rate: 600 },
      ],
    },
    {
      id: 'demo-act-soy-sowing-labour',
      cropId: soy,
      parentActivityId: 'demo-act-soy-sowing',
      type: 'Labour Activity',
      daysFromNow: -65,
      status: 'Completed',
      notes: 'Two helpers for seed loading and drill calibration.',
      expenses: [{ category: 'Labour', amount: 800, quantity: 2, unit: 'days', rate: 400 }],
    },
    {
      id: 'demo-act-soy-weeding',
      cropId: soy,
      type: 'Weeding',
      daysFromNow: -45,
      status: 'Completed',
      notes: 'First hand weeding. Broadleaf weeds cleared between rows.',
      expenses: [{ category: 'Labour', amount: 2400, quantity: 6, unit: 'days', rate: 400 }],
    },
    {
      id: 'demo-act-soy-fert',
      cropId: soy,
      type: 'Fertilizer Application',
      daysFromNow: -30,
      status: 'Completed',
      notes: 'NPK 19-19-19 broadcast before vegetative growth.',
      metadata: { fertilizerName: 'NPK 19-19-19', quantity: 50, applicationMethod: 'Broadcasting' },
      expenses: [{ category: 'Fertilizer', amount: 2200, quantity: 50, unit: 'kg', rate: 44 }],
    },
    {
      id: 'demo-act-soy-spray',
      cropId: soy,
      type: 'Spray Application',
      daysFromNow: -18,
      status: 'Completed',
      notes: 'Neem oil spray against girdle beetle and leaf miner.',
      metadata: {
        chemicalName: 'Neem oil 1500 ppm',
        dosage: '500 ml/ha',
        waterQuantity: 500,
        targetPest: 'Girdle beetle',
      },
      expenses: [
        { category: 'Pesticide', amount: 1350 },
        { category: 'Labour', amount: 400, quantity: 1, unit: 'days', rate: 400 },
      ],
    },
    {
      id: 'demo-act-soy-inspection',
      cropId: soy,
      type: 'Field Inspection',
      daysFromNow: -10,
      status: 'Completed',
      notes: 'Crop healthy at flowering. Plant height 55 cm, no pod borer seen.',
    },
    {
      id: 'demo-act-soy-irrigation',
      cropId: soy,
      type: 'Irrigation',
      daysFromNow: 1,
      status: 'Scheduled',
      notes: 'Drip irrigation to support pod setting if rain stays away.',
      metadata: { irrigationMethod: 'Drip', duration: 45, waterQuantity: 15000 },
      expenses: [{ category: 'Fuel', amount: 250 }],
    },
    {
      id: 'demo-act-soy-spray-2',
      cropId: soy,
      type: 'Spray Application',
      daysFromNow: 8,
      status: 'Scheduled',
      notes: 'Preventive spray for pod borer during pod formation.',
      metadata: { chemicalName: 'Bt formulation', dosage: '1 kg/ha', targetPest: 'Pod borer' },
      expenses: [{ category: 'Pesticide', amount: 1800 }],
    },
    {
      id: 'demo-act-wheat-prep',
      cropId: wheat,
      type: 'Maintenance',
      daysFromNow: -20,
      status: 'Completed',
      notes: 'Two passes of rotavator and one planking before sowing.',
      expenses: [{ category: 'Machine Rent', amount: 3200, quantity: 4, unit: 'hours', rate: 800 }],
    },
    {
      id: 'demo-act-wheat-sowing',
      cropId: wheat,
      type: 'Sowing',
      daysFromNow: -15,
      status: 'Completed',
      notes: 'HD-2967 sown with seed drill at 100 kg/ha.',
      expenses: [
        { category: 'Seeds', amount: 8000, quantity: 200, unit: 'kg', rate: 40 },
        { category: 'Labour', amount: 1200, quantity: 3, unit: 'days', rate: 400 },
      ],
    },
    {
      id: 'demo-act-wheat-irrigation',
      cropId: wheat,
      type: 'Irrigation',
      daysFromNow: -8,
      status: 'Completed',
      notes: 'Crown root initiation irrigation (first watering).',
      metadata: { irrigationMethod: 'Flood', duration: 240, waterQuantity: 60000 },
      expenses: [{ category: 'Fuel', amount: 900 }],
    },
    {
      id: 'demo-act-wheat-fert',
      cropId: wheat,
      type: 'Fertilizer Application',
      daysFromNow: 5,
      status: 'Scheduled',
      notes: 'Urea top dressing after first irrigation.',
      metadata: { fertilizerName: 'Urea', quantity: 100, applicationMethod: 'Broadcasting' },
      expenses: [{ category: 'Fertilizer', amount: 3000, quantity: 100, unit: 'kg', rate: 30 }],
    },
    {
      id: 'demo-act-wheat-weeding',
      cropId: wheat,
      type: 'Weeding',
      daysFromNow: 14,
      status: 'Scheduled',
      notes: 'Post-emergence herbicide at 30–35 days.',
    },
  ];

  for (const w of work) {
    const crop = crops.find((c) => c.id === w.cropId)!;
    const date = now + w.daysFromNow * ONE_DAY;
    push({
      id: w.id,
      cropId: w.cropId,
      fieldId: crop.fieldId,
      parentActivityId: w.parentActivityId,
      type: w.type,
      date,
      season: crop.season,
      status: w.status,
      notes: w.notes,
      attachments: [],
      metadata: w.metadata ?? {},
      createdAt: Math.min(date, now),
      updatedAt: Math.min(date, now),
    });
    (w.expenses ?? []).forEach((e, i) =>
      expenses.push({
        id: `${w.id}-exp-${i}`,
        activityId: w.id,
        category: e.category,
        amount: e.amount,
        quantity: e.quantity,
        unit: e.unit,
        rate: e.rate,
        createdAt: Math.min(date, now),
      }),
    );
  }

  // A land-level job with no crop (bore repair on the river plot)
  const boreDate = now - 40 * ONE_DAY;
  push({
    id: 'demo-act-bore',
    fieldId: 'demo-land-river',
    type: 'Maintenance',
    date: boreDate,
    season: 'Kharif',
    status: 'Completed',
    notes: 'Borewell pump serviced and 2 pipes replaced.',
    attachments: [],
    metadata: {},
    createdAt: boreDate,
    updatedAt: boreDate,
  });
  expenses.push(
    {
      id: 'demo-act-bore-exp-0',
      activityId: 'demo-act-bore',
      category: 'Equipment',
      amount: 2600,
      createdAt: boreDate,
    },
    {
      id: 'demo-act-bore-exp-1',
      activityId: 'demo-act-bore',
      category: 'Labour',
      amount: 600,
      createdAt: boreDate,
    },
  );

  return { farms, crops, activities, expenses };
}
