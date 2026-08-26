import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const configuredHosts = process.env['NG_ALLOWED_HOSTS']
  ?.split(',')
  .map((host) => host.trim())
  .filter(Boolean);
const angularApp = new AngularNodeAppEngine({
  allowedHosts: configuredHosts?.length ? configuredHosts : ['localhost', '127.0.0.1'],
});
function publicOrigin(request: express.Request): string {
  const configured = process.env['PUBLIC_ORIGIN']?.replace(/\/$/, '');
  if (configured) return configured;
  const forwardedProtocol = request.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProtocol === 'https' || request.protocol === 'https' ? 'https' : 'http';
  const host = request.get('host') ?? 'localhost:4000';
  return `${protocol}://${host}`;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]!);
}

app.use((request, response, next) => {
  if (request.path === '/editor' || request.path.startsWith('/editor/')) {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  } else if (request.path === '/' || request.path === '/learn') {
    response.setHeader('X-Robots-Tag', 'index, follow, max-image-preview:large, max-snippet:-1');
  }
  next();
});

app.get('/robots.txt', (request, response) => {
  response.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /editor',
    `Sitemap: ${publicOrigin(request)}/sitemap.xml`,
    '',
  ].join('\n'));
});

app.get('/sitemap.xml', (request, response) => {
  const origin = escapeXml(publicOrigin(request));
  response.type('application/xml').send([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${origin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${origin}/learn</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>`,
    '</urlset>',
  ].join('\n'));
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
