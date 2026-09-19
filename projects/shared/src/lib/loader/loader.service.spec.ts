import { LoaderService } from './loader.service';

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
});
