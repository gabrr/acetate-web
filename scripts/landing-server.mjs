import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
const root = resolve(fileURLToPath(new URL('../landing/', import.meta.url)));
const pages = { '/': '/index.html', '/privacy-policy': '/privacy-policy.html', '/terms-of-service': '/terms-of-service.html' };
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(root, '.' + (pages[path.replace(/\/$/, '') || '/'] || path));
  if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    let data = await readFile(file);
    if (file.endsWith('index.html')) data = Buffer.from(data.toString().replace('https://app.acetate.me/login', 'http://127.0.0.1:3000/login'));
    response.writeHead(200, { 'Content-Type': { '.html':'text/html', '.css':'text/css', '.svg':'image/svg+xml' }[extname(file)] || 'application/octet-stream' }).end(data);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(3001, '127.0.0.1', () => console.log('Landing: http://127.0.0.1:3001'));
