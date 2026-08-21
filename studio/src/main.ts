import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  window.location.reload();
});

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
