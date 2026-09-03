import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    jasmine.clock().install();
    service = new ToastService();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('shows, auto-dismisses and caps the stack at four', () => {
    service.success('Saved');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].kind).toBe('success');

    jasmine.clock().tick(3600);
    expect(service.toasts().length).toBe(0);

    for (let i = 0; i < 6; i++) service.info(`msg ${i}`, 0);
    expect(service.toasts().length).toBe(4);
    expect(service.toasts()[0].message).toBe('msg 2');
  });

  it('dismisses a single toast by id', () => {
    const a = service.info('a', 0);
    service.info('b', 0);
    service.dismiss(a.id);
    expect(service.toasts().map((t) => t.message)).toEqual(['b']);
  });
});
