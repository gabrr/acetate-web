import handler from '../server.mjs';
export const config = { api: { bodyParser: false } };
export default function route(request, response) {
  const url = new URL(request.url, 'http://localhost');
  request.url = url.searchParams.get('path') || '/';
  return handler(request, response);
}
