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
    loadComponent: () => import('./features/crop-timeline/crop-timeline.component').then((m) => m.CropTimelineComponent)
  }
];
