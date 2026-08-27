import { RenderMode, ServerRoute } from '@angular/ssr';

/** Static rendering boundary used only by the GitHub Pages build. */
export const pagesServerRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'learn', renderMode: RenderMode.Prerender },
  { path: 'editor', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Client },
];
