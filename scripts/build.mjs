import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname || new URL('..', import.meta.url).pathname, '..');
const vendor = resolve(root, 'public/vendor');
await rm(vendor, { recursive: true, force: true });
await mkdir(resolve(vendor, 'sse'), { recursive: true });
const files = {
  'marked.js': 'marked/lib/marked.esm.js',
  'dompurify.js': 'dompurify/dist/purify.es.mjs',
  'pico.css': '@picocss/pico/css/pico.min.css',
  'supabase.js': '@supabase/supabase-js/dist/umd/supabase.js',
  'file-pdf.svg': '@phosphor-icons/core/assets/regular/file-pdf.svg',
  'sse/index.js': '@microsoft/fetch-event-source/lib/esm/index.js',
  'sse/fetch': '@microsoft/fetch-event-source/lib/esm/fetch.js',
  'sse/parse': '@microsoft/fetch-event-source/lib/esm/parse.js',
};
for (const [name, source] of Object.entries(files)) await cp(resolve(root, 'node_modules', source), resolve(vendor, name));
console.log('Prepared local browser dependencies.');
