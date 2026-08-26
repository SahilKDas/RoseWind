import { RenderMode } from '@angular/ssr';
import { describe, expect, it } from 'vitest';
import { serverRoutes } from './app.routes.server';

describe('crawler rendering boundary', () => {
  it('server-renders the homepage and language documentation', () => {
    expect(serverRoutes.find((route) => route.path === '')?.renderMode).toBe(RenderMode.Server);
    expect(serverRoutes.find((route) => route.path === 'learn')?.renderMode).toBe(RenderMode.Server);
  });

  it('keeps the interactive editor client-rendered', () => {
    expect(serverRoutes.find((route) => route.path === 'editor')?.renderMode).toBe(RenderMode.Client);
  });
});
