import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { invited, requestAccess } from './server/entry.mjs';
import { proxyBackend, isBackendRoute } from './server/backend.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
const envFile = resolve(root, production ? '.env.prod' : '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const backendUrl = process.env.BACKEND_URL?.trim() || (production ? '' : 'http://127.0.0.1:8080');
if (!backendUrl) {
  throw new Error('Set BACKEND_URL in .env.prod before starting production.');
}
const port = Number(process.env.PORT || 3000);
const publicRoot = resolve(root, 'public');
const vendor = {
  '/vendor/supabase.js': 'node_modules/@supabase/supabase-js/dist/umd/supabase.js',
  '/vendor/marked.js': 'node_modules/marked/lib/marked.esm.js',
  '/vendor/dompurify.js': 'node_modules/dompurify/dist/purify.es.mjs',
  '/vendor/pico.css': 'node_modules/@picocss/pico/css/pico.min.css',
  '/vendor/sse/index.js': 'node_modules/@microsoft/fetch-event-source/lib/esm/index.js',
  '/vendor/sse/fetch': 'node_modules/@microsoft/fetch-event-source/lib/esm/fetch.js',
  '/vendor/sse/parse': 'node_modules/@microsoft/fetch-event-source/lib/esm/parse.js',
  '/vendor/file-pdf.svg': 'node_modules/@phosphor-icons/core/assets/regular/file-pdf.svg',
};
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml' };

export default async function handler(request, response) {
  const pathname = new URL(request.url, 'http://localhost').pathname;

  if (pathname === '/api/auth/config' && request.method === 'GET') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({
      appOrigin: process.env.AUTH_APP_ORIGIN || 'https://app.acetate.me',
      landingOrigin: process.env.AUTH_LANDING_ORIGIN || 'https://www.acetate.me',
      loginUrl: (process.env.AUTH_LANDING_ORIGIN || 'https://www.acetate.me') + '/#sign-in',
      callbackUrl: process.env.AUTH_CALLBACK_URL || (process.env.AUTH_LANDING_ORIGIN || 'https://www.acetate.me') + '/?auth=callback',
      passkeysEnabled: process.env.AUTH_PASSKEYS_ENABLED === 'true',
      url: process.env.AUTH_SUPABASE_URL || '',
      publishableKey: process.env.AUTH_SUPABASE_PUBLISHABLE_KEY || '',
    }));
    return;
  }

  if (pathname === '/login') { response.writeHead(302, { Location: (process.env.AUTH_LANDING_ORIGIN || 'https://www.acetate.me') + '/#sign-in', 'Cache-Control': 'no-store' }).end(); return; }
  if (pathname === '/api/request-access' && request.method === 'POST') { await requestAccess(request, response); return; }
  if (pathname === '/api/auth/authorize' || isBackendRoute(pathname, request.method)) {
    const status = await invited(request);
    if (status !== 200) { response.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store' }).end(JSON.stringify({error:'Account access unavailable.'})); return; }
    if (pathname === '/api/auth/authorize') { response.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'}).end('{}'); return; }
  }
  if (isBackendRoute(pathname, request.method)) {
    await proxyBackend(request, response, backendUrl);
    return;
  }
  const legal = { '/privacy-policy': 'privacy-policy', '/privacy': 'privacy-policy', '/terms-of-service': 'terms-of-service', '/terms': 'terms-of-service' };
  if (legal[pathname.replace(/\/$/, '')]) {
    response.writeHead(302, { Location: `https://acetate.me/${legal[pathname.replace(/\/$/, '')]}` }).end();
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end('Method not allowed');
    return;
  }

  const file = vendor[pathname]
    ? (existsSync(resolve(publicRoot, '.' + pathname)) ? resolve(publicRoot, '.' + pathname) : resolve(root, vendor[pathname]))
    : resolve(publicRoot, '.' + (pathname === '/auth/receive' ? '/auth-receive.html' : ['/', '/auth/callback'].includes(pathname) ? '/index.html' : pathname));

  if (!vendor[pathname] && !file.startsWith(publicRoot + sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const content = await readFile(file);
    if (pathname === '/auth/receive') response.setHeader('Content-Security-Policy', `frame-ancestors ${process.env.AUTH_LANDING_ORIGIN || 'https://www.acetate.me'}`);
    response.writeHead(200, { 'Content-Type': (pathname.startsWith('/vendor/sse/') ? 'text/javascript' : mime[extname(file)] || 'application/octet-stream') });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404).end('Not found');
  }
}

if (!process.env.VERCEL) createServer(handler).listen(port, '127.0.0.1', () => {
  console.log(`Frontend 0.2: http://127.0.0.1:${port}`);
});
