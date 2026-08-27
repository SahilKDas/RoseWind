import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { pagesServerRoutes } from './app.routes.pages.server';

const pagesServerConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(pagesServerRoutes))],
};

export const pagesConfig = mergeApplicationConfig(appConfig, pagesServerConfig);
