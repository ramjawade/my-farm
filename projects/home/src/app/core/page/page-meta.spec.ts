import { DOCUMENT } from '@angular/common';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, TitleStrategy, provideRouter, withRouterConfig } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { routes as appRoutes } from '../../app.routes';
import { AppTitleStrategy } from './app-title.strategy';
import { PageMetaService, fillParams } from './page-meta.service';

@Component({ template: '<router-outlet />' })
class Stub {}

const testRoutes: Routes = [
  { path: 'reports', component: Stub, title: 'shell.title.reports', data: { section: 'reports' } },
  {
    path: 'crops',
    component: Stub,
    title: 'shell.title.crops',
    data: { section: 'crops' },
    children: [
      { path: '', component: Stub },
      { path: 'add', component: Stub, title: 'shell.title.addCrop', data: { parent: '/crops' } },
      {
        path: ':cropId',
        component: Stub,
        title: 'shell.title.cropDetail',
        data: { parent: '/crops' },
        children: [
          {
            path: 'list',
            component: Stub,
            title: 'shell.title.activityList',
            data: { parent: '/crops/:cropId' },
          },
        ],
      },
    ],
  },
  { path: '**', component: Stub, title: 'shell.title.notFound' },
];

describe('page title and meta', () => {
  let router: Router;
  let translate: TranslateService;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(testRoutes, withRouterConfig({ paramsInheritanceStrategy: 'always' })),
        provideTranslateService({ lang: 'en' }),
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
      ],
    });
    router = TestBed.inject(Router);
    translate = TestBed.inject(TranslateService);
    doc = TestBed.inject(DOCUMENT);
    translate.setTranslation('en', {
      shell: {
        title: {
          reports: 'Reports',
          crops: 'Crops',
          addCrop: 'Add crop',
          cropDetail: 'Crop detail',
          activityList: 'All activities',
          notFound: 'Page not found',
        },
      },
    });
    translate.setTranslation('mr', { shell: { title: { reports: 'अहवाल' } } });
  });

  describe('AppTitleStrategy', () => {
    it('sets "<title> · My Farm"', async () => {
      await router.navigateByUrl('/reports');
      expect(doc.title).toBe('Reports · My Farm');
    });

    it('uses the deepest route title and the not-found title', async () => {
      await router.navigateByUrl('/crops/7');
      expect(doc.title).toBe('Crop detail · My Farm');
      await router.navigateByUrl('/nowhere');
      expect(doc.title).toBe('Page not found · My Farm');
    });

    it('re-translates when the language changes', async () => {
      await router.navigateByUrl('/reports');
      await translate.use('mr').toPromise();
      expect(doc.title).toBe('अहवाल · My Farm');
    });
  });

  describe('PageMetaService', () => {
    it('exposes the title key and section of the current page', async () => {
      const meta = TestBed.inject(PageMetaService);
      await router.navigateByUrl('/reports');
      expect(meta.titleKey()).toBe('shell.title.reports');
      expect(meta.section()).toBe('reports');
      expect(meta.parentUrl()).toBeUndefined();
    });

    it('keeps the section of a child page and gives its parent', async () => {
      const meta = TestBed.inject(PageMetaService);
      await router.navigateByUrl('/crops/add');
      expect(meta.titleKey()).toBe('shell.title.addCrop');
      expect(meta.section()).toBe('crops');
      expect(meta.parentUrl()).toBe('/crops');
    });

    it('fills route params into the parent', async () => {
      const meta = TestBed.inject(PageMetaService);
      await router.navigateByUrl('/crops/42/list');
      expect(meta.parentUrl()).toBe('/crops/42');
      expect(meta.section()).toBe('crops');
    });

    it('has no section on the not-found page', async () => {
      const meta = TestBed.inject(PageMetaService);
      await router.navigateByUrl('/nowhere');
      expect(meta.titleKey()).toBe('shell.title.notFound');
      expect(meta.section()).toBeUndefined();
    });
  });

  it('fillParams leaves paths without tokens alone', () => {
    expect(fillParams('/crops', {})).toBe('/crops');
    expect(fillParams(undefined, {})).toBeUndefined();
  });
});

describe('route table', () => {
  interface Walked {
    path: string;
    title?: string;
    section?: string;
    parent?: string;
  }

  function walk(
    rs: Routes,
    inherited: { title?: string; section?: string },
    prefix: string,
  ): Walked[] {
    return rs.flatMap((r) => {
      const title = typeof r.title === 'string' ? r.title : inherited.title;
      const section = (r.data?.['section'] as string | undefined) ?? inherited.section;
      const own: Walked[] = r.loadComponent
        ? [
            {
              path: `${prefix}/${r.path}`,
              title,
              section,
              parent: r.data?.['parent'] as string | undefined,
            },
          ]
        : [];
      return [...own, ...walk(r.children ?? [], { title, section }, `${prefix}/${r.path}`)];
    });
  }

  const walked = walk(appRoutes, {}, '');

  it('gives every route a title', () => {
    expect(walked.filter((w) => !w.title).map((w) => w.path)).toEqual([]);
  });

  it('gives every signed-in route a section (login and 404 excepted)', () => {
    const missing = walked
      .filter((w) => !w.section && w.path !== '/login' && w.path !== '/**')
      .map((w) => w.path);
    expect(missing).toEqual([]);
  });

  it('only uses params in a parent that the route provides', () => {
    expect(walked.find((w) => w.parent?.includes(':cropId'))?.path).toContain(':cropId');
  });
});
