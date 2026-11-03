import { LoaderService, SLOW_START_MS } from './loader.service';

describe('LoaderService', () => {
  let service: LoaderService;

  beforeEach(() => {
    service = new LoaderService();
  });

  it('is not loading when nothing is active', () => {
    expect(service.isLoading()).toBeFalse();
  });

  it('is loading while a request is in flight, and stops once hidden', () => {
    const id = service.show();
    expect(service.isLoading()).toBeTrue();

    service.hide(id);
    expect(service.isLoading()).toBeFalse();
  });

  it('stays loading until every overlapping request is hidden', () => {
    const a = service.show();
    const b = service.show();
    expect(service.isLoading()).toBeTrue();

    service.hide(a);
    expect(service.isLoading()).toBeTrue();

    service.hide(b);
    expect(service.isLoading()).toBeFalse();
  });

  it('ignores hiding an id that was already hidden or never shown', () => {
    const id = service.show();
    service.hide(id);
    service.hide(id);
    service.hide('never-shown');
    expect(service.isLoading()).toBeFalse();
  });

  describe('slow start', () => {
    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    it('is not slow before 3 seconds, and is slow after', () => {
      service.show();
      jasmine.clock().tick(SLOW_START_MS - 1);
      expect(service.slow()).toBeFalse();

      jasmine.clock().tick(1);
      expect(service.slow()).toBeTrue();
    });

    it('stops being slow when the first load ends', () => {
      const id = service.show();
      jasmine.clock().tick(SLOW_START_MS);
      service.hide(id);

      expect(service.slow()).toBeFalse();
    });

    it('is never slow when the first load finishes in time', () => {
      const id = service.show();
      jasmine.clock().tick(SLOW_START_MS - 1);
      service.hide(id);
      jasmine.clock().tick(SLOW_START_MS * 2);

      expect(service.slow()).toBeFalse();
    });

    it('is never slow for a request after the first load', () => {
      service.hide(service.show());
      service.show();
      jasmine.clock().tick(SLOW_START_MS * 2);

      expect(service.slow()).toBeFalse();
    });

    it('keeps one timer for overlapping first requests', () => {
      const a = service.show();
      jasmine.clock().tick(SLOW_START_MS - 1000);
      const b = service.show();
      jasmine.clock().tick(1000);
      expect(service.slow()).toBeTrue();

      service.hide(a);
      expect(service.slow()).toBeTrue();
      service.hide(b);
      expect(service.slow()).toBeFalse();
    });
  });
});
