import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { authorizedIdentity, entryConfig } from "@/auth/entry";

export async function POST(request: NextRequest) {
  const settings = entryConfig();
  const failure = (status: number) => NextResponse.json({}, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== settings.appOrigin) return failure(403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return failure(415);
  try {
    const raw = await request.text();
    if (raw.length > 16384) return failure(413);
    const { access_token, refresh_token } = JSON.parse(raw);
    if (typeof access_token !== "string" || typeof refresh_token !== "string") return failure(400);
    if (!(await authorizedIdentity(access_token))) return failure(401);
    const response = NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
    const client = createServerClient(settings.url, settings.publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    });
    const { data, error } = await client.auth.setSession({ access_token, refresh_token });
    // Validate the resulting session too: refresh may have changed the token.
    if (error || !data.session || !(await authorizedIdentity(data.session.access_token))) return failure(401);
    return response;
  } catch { return failure(400); }
}
