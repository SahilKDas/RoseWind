import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { pagesConfig } from './app/app.config.pages.server';

const bootstrap = (context: BootstrapContext) => bootstrapApplication(App, pagesConfig, context);

export default bootstrap;
