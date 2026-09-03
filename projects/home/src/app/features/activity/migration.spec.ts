import { migrateSchemaV2 } from './migration';

describe('migrateSchemaV2', () => {
  beforeEach(() => localStorage.clear());

  it('drops crop-timeline mirror keys and normalises seasons once', () => {
    localStorage.setItem('my_farm_u1_crop_activities', '[]');
    localStorage.setItem(
      'my_farm_u1_activities',
      JSON.stringify([
        { id: 'a1', season: 'Summer' },
        { id: 'a2', season: 'Kharif' },
      ]),
    );

    migrateSchemaV2();

    expect(localStorage.getItem('my_farm_u1_crop_activities')).toBeNull();
    const acts = JSON.parse(localStorage.getItem('my_farm_u1_activities')!);
    expect(acts[0].season).toBe('Zaid');
    expect(acts[1].season).toBe('Kharif');
    expect(localStorage.getItem('my_farm_schema_version')).toBe('2');

    // Second run is a no-op
    localStorage.setItem('my_farm_u1_crop_activities', '[]');
    migrateSchemaV2();
    expect(localStorage.getItem('my_farm_u1_crop_activities')).toBe('[]');
  });
});
