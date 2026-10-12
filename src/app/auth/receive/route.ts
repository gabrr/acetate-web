import { entryConfig } from "@/auth/entry";
export function GET() {
  const { landingOrigin } = entryConfig();
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>Connecting to Acetate</title><script src="/auth-receive.js" defer></script></head><body></body></html>', {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; script-src 'self'; connect-src 'self'; frame-ancestors ${landingOrigin}`,
    },
  });
}
