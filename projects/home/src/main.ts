import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { migrateActivityData } from './app/features/activity/migration';

// Run data migration before app initialization
migrateActivityData();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
