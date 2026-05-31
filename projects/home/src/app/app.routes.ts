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
  }
];
