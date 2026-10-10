import { CROP_STAGES } from './crop-timeline.models';
import { STAGE_STEPS, cropIconClass, stageStep } from './crop-timeline.utils';

describe('crop timeline helpers', () => {
  it('maps the eight stored stages onto the four displayed steps', () => {
    expect(CROP_STAGES.map((stage) => stageStep(stage))).toEqual([0, 0, 0, 1, 2, 2, 3, 3]);
    expect(STAGE_STEPS.length).toBe(4);
  });

  it('treats an unknown stage as the first step', () => {
    expect(stageStep('Something else')).toBe(0);
  });

  it('picks an icon by crop name', () => {
    expect(cropIconClass('Sweet Corn')).toBe('bi-flower2');
    expect(cropIconClass('Wheat')).toBe('bi-tree');
    expect(cropIconClass('Pomegranate')).toBe('bi-apple');
    expect(cropIconClass('Onion')).toBe('bi-flower1');
  });
});
