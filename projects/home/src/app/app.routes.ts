import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'map',
    loadComponent: () => import('./map/map').then((m) => m.MapComponent),
    canActivate: [authGuard]
  },
  {
    path: 'weather',
    loadComponent: () => import('./features/weather/weather.component').then((m) => m.WeatherComponent),
    canActivate: [authGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./features/farmer-registration/farmer-registration.component').then((m) => m.FarmerRegistrationComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'crops',
    loadComponent: () => import('./features/crop-timeline/crop-timeline.component').then((m) => m.CropTimelineComponent),
    canActivate: [authGuard],
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
    canActivate: [authGuard],
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
