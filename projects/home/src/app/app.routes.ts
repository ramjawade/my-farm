import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import {
  addItemResolver,
  myApmcsResolver,
  newListResolver,
  priceDetailResolver,
  pricesResolver,
} from './features/prices/prices-data';

/**
 * Every signed-in route declares `title` (a translation key) and
 * `data.section` (a nav key, absent for the 404 page); a page that has a
 * parent adds `data.parent`, an absolute path that may contain route params
 * (e.g. `/crops/:cropId`). The tab title, the phone header, the highlighted
 * nav item and the back arrow are all read from these. With
 * `paramsInheritanceStrategy: 'always'` a child inherits its parent's data,
 * and the deepest route wins.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'shell.title.home',
    data: { section: 'home' },
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    title: 'shell.title.login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'map',
    title: 'shell.title.lands',
    data: { section: 'lands' },
    loadComponent: () => import('./map/map').then((m) => m.MapComponent),
    canActivate: [authGuard],
  },
  {
    path: 'weather',
    title: 'shell.title.weather',
    data: { section: 'weather' },
    loadComponent: () =>
      import('./features/weather/weather.component').then((m) => m.WeatherComponent),
    canActivate: [authGuard],
  },
  {
    path: 'chat',
    title: 'shell.title.assistant',
    data: { section: 'assistant' },
    loadComponent: () =>
      import('./features/chat-bot/chat-page/chat-page.component').then((m) => m.ChatPageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    title: 'shell.title.profile',
    data: { section: 'profile', parent: '/' },
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
  },
  {
    path: 'crops',
    title: 'shell.title.crops',
    data: { section: 'crops' },
    loadComponent: () =>
      import('./features/crop-timeline/crop-timeline.component').then(
        (m) => m.CropTimelineComponent,
      ),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/crop-timeline/dashboard/crop-dashboard.component').then(
            (m) => m.CropDashboardComponent,
          ),
      },
      {
        path: 'add',
        title: 'shell.title.addCrop',
        data: { parent: '/crops' },
        loadComponent: () =>
          import('./features/crop-timeline/add-crop/add-crop.component').then(
            (m) => m.AddCropComponent,
          ),
      },
      {
        path: ':cropId/edit',
        title: 'shell.title.editCrop',
        data: { parent: '/crops/:cropId' },
        loadComponent: () =>
          import('./features/crop-timeline/add-crop/add-crop.component').then(
            (m) => m.AddCropComponent,
          ),
      },
      {
        path: ':cropId',
        title: 'shell.title.cropDetail',
        data: { parent: '/crops' },
        loadComponent: () =>
          import('./features/crop-timeline/crop-activity/crop-activity.component').then(
            (m) => m.CropActivityComponent,
          ),
        children: [
          {
            path: 'list',
            title: 'shell.title.activityList',
            data: { parent: '/crops/:cropId' },
            loadComponent: () =>
              import('./features/farm-activity/list/activity-list.component').then(
                (m) => m.ActivityListComponent,
              ),
          },
          {
            path: 'create',
            title: 'shell.title.logActivity',
            data: { parent: '/crops/:cropId' },
            loadComponent: () =>
              import('./features/farm-activity/create/create-activity.component').then(
                (m) => m.CreateActivityComponent,
              ),
          },
          {
            path: 'sales/new',
            title: 'shell.title.recordSale',
            data: { parent: '/crops/:cropId' },
            loadComponent: () =>
              import('./features/crop-timeline/crop-sales/sale-form.component').then(
                (m) => m.SaleFormComponent,
              ),
          },
          {
            path: 'sales/:saleId/edit',
            title: 'shell.title.editSale',
            data: { parent: '/crops/:cropId' },
            loadComponent: () =>
              import('./features/crop-timeline/crop-sales/sale-form.component').then(
                (m) => m.SaleFormComponent,
              ),
          },
        ],
      },
    ],
  },
  {
    path: 'activities',
    title: 'shell.title.activity',
    data: { section: 'activity' },
    loadComponent: () =>
      import('./features/farm-activity/farm-activity.component').then(
        (m) => m.FarmActivityComponent,
      ),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/farm-activity/dashboard/activity-dashboard.component').then(
            (m) => m.ActivityDashboardComponent,
          ),
      },
      {
        path: 'list',
        title: 'shell.title.activityList',
        data: { parent: '/activities' },
        loadComponent: () =>
          import('./features/farm-activity/list/activity-list.component').then(
            (m) => m.ActivityListComponent,
          ),
      },
      {
        path: 'create',
        title: 'shell.title.logActivity',
        data: { parent: '/activities' },
        loadComponent: () =>
          import('./features/farm-activity/create/create-activity.component').then(
            (m) => m.CreateActivityComponent,
          ),
      },
      {
        path: 'expenses/new',
        title: 'shell.title.addExpense',
        data: { parent: '/activities' },
        loadComponent: () =>
          import('./features/farm-activity/expense/expense-form.component').then(
            (m) => m.ExpenseFormComponent,
          ),
      },
      {
        path: ':activityId/expenses/:expenseId/edit',
        title: 'shell.title.editExpense',
        data: { parent: '/activities' },
        loadComponent: () =>
          import('./features/farm-activity/expense/expense-form.component').then(
            (m) => m.ExpenseFormComponent,
          ),
      },
      {
        path: ':id',
        title: 'shell.title.activityDetail',
        data: { parent: '/activities' },
        loadComponent: () =>
          import('./features/farm-activity/detail/activity-detail.component').then(
            (m) => m.ActivityDetailComponent,
          ),
      },
    ],
  },
  {
    path: 'reports',
    title: 'shell.title.reports',
    data: { section: 'reports' },
    loadComponent: () =>
      import('./features/reports/reports.component').then((m) => m.ReportsComponent),
    canActivate: [authGuard],
  },
  {
    // No component: the children share this section and title, and the page data is
    // resolved before each child opens.
    path: 'prices',
    title: 'shell.title.prices',
    data: { section: 'prices' },
    canActivate: [authGuard],
    children: [
      {
        path: '',
        resolve: { data: pricesResolver },
        loadComponent: () =>
          import('./features/prices/prices-list.component').then((m) => m.PricesListComponent),
      },
      {
        path: 'mandis',
        title: 'shell.title.myApmcs',
        data: { parent: '/prices' },
        resolve: { data: myApmcsResolver },
        loadComponent: () =>
          import('./features/prices/my-apmcs.component').then((m) => m.MyApmcsComponent),
      },
      {
        path: 'lists/new',
        title: 'shell.title.newList',
        data: { parent: '/prices' },
        resolve: { data: newListResolver },
        loadComponent: () =>
          import('./features/prices/new-list.component').then((m) => m.NewListComponent),
      },
      {
        path: 'lists/:id/add',
        title: 'shell.title.addItem',
        data: { parent: '/prices?list=:id' },
        resolve: { data: addItemResolver },
        loadComponent: () =>
          import('./features/prices/add-item.component').then((m) => m.AddItemComponent),
      },
      {
        path: ':crop',
        title: 'shell.title.priceDetail',
        data: { parent: '/prices' },
        resolve: { data: priceDetailResolver },
        loadComponent: () =>
          import('./features/prices/price-detail.component').then((m) => m.PriceDetailComponent),
      },
    ],
  },
  {
    path: '**',
    title: 'shell.title.notFound',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
