import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'map', pathMatch: 'full' },
  {
    path: 'map',
    loadComponent: () => import('./map/map').then((m) => m.MapComponent)
  },
  {
    path: 'weather',
    loadComponent: () => import('./features/weather/weather.component').then((m) => m.WeatherComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/farmer-registration/farmer-registration.component').then((m) => m.FarmerRegistrationComponent)
  },
  {
    path: 'crops',
    loadComponent: () => import('./features/crop-timeline/crop-timeline.component').then((m) => m.CropTimelineComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/crop-timeline/dashboard/crop-dashboard.component').then((m) => m.CropDashboardComponent)
      },
      {
        path: 'add',
        loadComponent: () => import('./features/crop-timeline/add-crop/add-crop.component').then((m) => m.AddCropComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('./features/crop-timeline/detail/crop-timeline-detail.component').then((m) => m.CropTimelineDetailComponent)
      }
    ]
  },
  {
    path: 'activities',
    loadComponent: () => import('./features/farm-activity/farm-activity.component').then((m) => m.FarmActivityComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/farm-activity/dashboard/activity-dashboard.component').then((m) => m.ActivityDashboardComponent)
      },
      {
        path: 'list',
        loadComponent: () => import('./features/farm-activity/list/activity-list.component').then((m) => m.ActivityListComponent)
      },
      {
        path: 'create',
        loadComponent: () => import('./features/farm-activity/create/create-activity.component').then((m) => m.CreateActivityComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('./features/farm-activity/detail/activity-detail.component').then((m) => m.ActivityDetailComponent)
      }
    ]
  }
];
