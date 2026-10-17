import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { NewListData } from './prices-data';
import { NewListComponent } from './new-list.component';
import { WatchlistsService } from './watchlists.service';

describe('NewListComponent', () => {
  let fixture: ComponentFixture<NewListComponent>;
  let watchlists: jasmine.SpyObj<WatchlistsService>;
  let navigate: jasmine.Spy;
  let toast: { success: jasmine.Spy; error: jasmine.Spy };
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const input = () => el().querySelector<HTMLInputElement>('#nl-name')!;

  async function open(data: NewListData): Promise<void> {
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    await fixture.whenStable();
  }
  async function submit(name: string): Promise<void> {
    input().value = name;
    input().dispatchEvent(new Event('input'));
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  beforeEach(() => {
    watchlists = jasmine.createSpyObj<WatchlistsService>('WatchlistsService', ['create']);
    watchlists.create.and.callFake(async (name) => ({ id: 11, name, items: [] }) as never);
    toast = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
    TestBed.configureTestingModule({
      imports: [NewListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService(),
        { provide: WatchlistsService, useValue: watchlists },
        { provide: ToastService, useValue: toast },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(NewListComponent);
  });

  it('asks for a name and creates nothing without one', async () => {
    await open({ status: 'ok', names: [] });
    await submit('   ');
    expect(text()).toContain('prices.listNameRequired');
    expect(watchlists.create).not.toHaveBeenCalled();
  });

  it('refuses a name already used, in any case', async () => {
    await open({ status: 'ok', names: ['Onion markets'] });
    await submit('ONION MARKETS');
    expect(text()).toContain('prices.listNameTaken');
    expect(watchlists.create).not.toHaveBeenCalled();
  });

  it('refuses "My farm" in any case, since that is the built-in tab', async () => {
    await open({ status: 'ok', names: [] });
    await submit('my FARM');
    expect(text()).toContain('prices.listNameTaken');
    expect(watchlists.create).not.toHaveBeenCalled();
  });

  it('limits the name to 30 characters', async () => {
    await open({ status: 'ok', names: [] });
    expect(input().getAttribute('maxlength')).toBe('30');

    await submit('x'.repeat(31));
    expect(text()).toContain('prices.listNameTooLong');
    expect(watchlists.create).not.toHaveBeenCalled();
  });

  it('creates the list with a trimmed name, says so and opens its tab', async () => {
    await open({ status: 'ok', names: ['Other'] });
    await submit('  Onion markets  ');

    expect(watchlists.create).toHaveBeenCalledWith('Onion markets');
    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/prices'], { queryParams: { list: 11 } });
  });

  it('shows the name message when the backend refuses a name the page allowed', async () => {
    watchlists.create.and.rejectWith(
      new HttpErrorResponse({ status: 409, error: { title: 'name_taken' } }),
    );
    await open({ status: 'ok', names: [] });
    await submit('Race');

    expect(text()).toContain('prices.listNameTaken');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stays on the form when saving fails for another reason', async () => {
    watchlists.create.and.rejectWith(new HttpErrorResponse({ status: 500 }));
    await open({ status: 'ok', names: [] });
    await submit('Fine name');
    expect(navigate).not.toHaveBeenCalled();
    expect(input().value).toBe('Fine name');
  });

  it('says the limit is reached at ten lists and does not create another', async () => {
    const names = Array.from({ length: 10 }, (_, i) => `List ${i}`);
    await open({ status: 'ok', names });
    expect(text()).toContain('prices.listLimit');
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBeTrue();

    await submit('One more');
    expect(watchlists.create).not.toHaveBeenCalled();
  });

  it('shows an error when the lists could not be loaded', async () => {
    await open({ status: 'error' });
    expect(text()).toContain('prices.errorTitle');
    expect(el().querySelector('form')).toBeNull();
  });
});
