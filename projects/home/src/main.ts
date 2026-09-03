import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { migrateActivityData, migrateSchemaV2 } from './app/features/activity/migration';

// Run data migrations before app initialization
migrateActivityData();
migrateSchemaV2();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
