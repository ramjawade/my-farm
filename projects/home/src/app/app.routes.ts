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
  }
];
