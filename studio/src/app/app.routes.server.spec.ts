import { RenderMode } from '@angular/ssr';
import { describe, expect, it } from 'vitest';
import { serverRoutes } from './app.routes.server';
import { pagesServerRoutes } from './app.routes.pages.server';

describe('crawler rendering boundary', () => {
  it('server-renders the homepage and language documentation', () => {
    expect(serverRoutes.find((route) => route.path === '')?.renderMode).toBe(RenderMode.Server);
    expect(serverRoutes.find((route) => route.path === 'learn')?.renderMode).toBe(RenderMode.Server);
  });

  it('keeps the interactive editor client-rendered', () => {
    expect(serverRoutes.find((route) => route.path === 'editor')?.renderMode).toBe(RenderMode.Client);
  });
  it('prerenders public Pages routes and keeps the editor client-only', () => {
    expect(pagesServerRoutes.find((route) => route.path === '')?.renderMode).toBe(RenderMode.Prerender);
    expect(pagesServerRoutes.find((route) => route.path === 'learn')?.renderMode).toBe(RenderMode.Prerender);
    expect(pagesServerRoutes.find((route) => route.path === 'editor')?.renderMode).toBe(RenderMode.Client);
  });
});
