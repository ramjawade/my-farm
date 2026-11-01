import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { ChatOrchestratorService } from '../../features/chat-bot/chat-orchestrator.service';
import { ChatOverlayService } from '../../features/chat-bot/chat-overlay.service';
import { FarmDrawService } from '../../map/farm-draw/farm-draw.service';
import { QuickActions } from './quick-actions';

describe('QuickActions', () => {
  let fixture: ComponentFixture<QuickActions>;
  let router: Router;
  const drawing = signal(false);
  const startDrawing = jasmine.createSpy('startDrawing');
  const onOpen = jasmine.createSpy('onOpen').and.resolveTo();
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (id: string) => el().querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
  const labels = () =>
    [...el().querySelectorAll('.quick-item .quick-label')].map((n) => n.textContent!.trim());

  async function setup(url: string) {
    drawing.set(false);
    startDrawing.calls.reset();
    onOpen.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: '**', children: [] }]),
        provideTranslateService(),
        { provide: FarmDrawService, useValue: { isDrawing: drawing.asReadonly(), startDrawing } },
        { provide: ChatOrchestratorService, useValue: { onOpen } },
      ],
    });
    router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(QuickActions);
    fixture.detectChanges();
  }

  it('lists the Home actions in order when the button is opened', async () => {
    await setup('/');
    expect(q('quick-toggle')!.getAttribute('aria-expanded')).toBe('false');

    q('quick-toggle')!.click();
    fixture.detectChanges();

    expect(labels()).toEqual([
      'quickActions.activity',
      'quickActions.expense',
      'quickActions.crop',
      'quickActions.land',
      'quickActions.assistant',
    ]);
    expect(q('quick-toggle')!.getAttribute('aria-expanded')).toBe('true');
    expect(q('quick-scrim')).not.toBeNull();
  });

  it('offers Draw land, Add crop and Ask assistant on Lands', async () => {
    await setup('/map');
    q('quick-toggle')!.click();
    fixture.detectChanges();

    expect(labels()).toEqual(['quickActions.land', 'quickActions.crop', 'quickActions.assistant']);
  });

  it('offers Add crop, Log activity and Ask assistant on Crops', async () => {
    await setup('/crops');
    q('quick-toggle')!.click();
    fixture.detectChanges();

    expect(labels()).toEqual([
      'quickActions.crop',
      'quickActions.activity',
      'quickActions.assistant',
    ]);
  });

  it('offers Log activity, Add expense and Ask assistant on the Activity screen', async () => {
    await setup('/activities/list');
    q('quick-toggle')!.click();
    fixture.detectChanges();

    expect(labels()).toEqual([
      'quickActions.activity',
      'quickActions.expense',
      'quickActions.assistant',
    ]);
  });

  it('does the one action directly on Prices, Reports and Weather', async () => {
    for (const url of ['/prices', '/reports', '/weather']) {
      TestBed.resetTestingModule();
      await setup(url);

      expect(q('quick-toggle')).toBeNull();
      q('quick-single')!.click();
      expect(TestBed.inject(ChatOverlayService).open()).toBeTrue();
      expect(onOpen).toHaveBeenCalled();
    }
  });

  it('closes the menu and opens the screen when an action is chosen', async () => {
    await setup('/crops');
    q('quick-toggle')!.click();
    fixture.detectChanges();

    q('quick-crop')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/crops/add');
    expect(el().querySelector('.quick-menu')).toBeNull();
  });

  it('Ask assistant opens the overlay', async () => {
    await setup('/crops');
    q('quick-toggle')!.click();
    fixture.detectChanges();

    q('quick-assistant')!.click();

    expect(TestBed.inject(ChatOverlayService).open()).toBeTrue();
    expect(onOpen).toHaveBeenCalled();
  });

  it('Draw land goes to Lands and starts drawing', async () => {
    await setup('/');
    q('quick-toggle')!.click();
    fixture.detectChanges();

    q('quick-land')!.click();
    await fixture.whenStable();

    expect(router.url).toBe('/map');
    expect(startDrawing).toHaveBeenCalled();
  });

  it('shows nothing on sub-screens or the Assistant page', async () => {
    for (const url of [
      '/crops/add',
      '/activities/create',
      '/activities/5',
      '/prices/mandis',
      '/chat',
      '/profile',
    ]) {
      TestBed.resetTestingModule();
      await setup(url);

      expect(el().querySelector('.quick-dial')).toBeNull();
    }
  });

  it('shows nothing while a land is being drawn', async () => {
    await setup('/map');
    expect(el().querySelector('.quick-dial')).not.toBeNull();

    drawing.set(true);
    fixture.detectChanges();

    expect(el().querySelector('.quick-dial')).toBeNull();
  });

  it('closes on the backdrop and on Escape, and the toggle keeps focus', async () => {
    await setup('/');
    q('quick-toggle')!.click();
    fixture.detectChanges();
    q('quick-scrim')!.click();
    fixture.detectChanges();
    expect(el().querySelector('.quick-menu')).toBeNull();

    q('quick-toggle')!.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(el().querySelector('.quick-menu')).toBeNull();
    expect(document.activeElement).toBe(q('quick-toggle'));
  });

  it('is hidden on wide screens by the d-lg-none class', async () => {
    await setup('/');

    expect(el().classList).toContain('d-lg-none');
  });
});
