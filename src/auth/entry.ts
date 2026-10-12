import { createClient } from "@supabase/supabase-js";
import { allowedUserEmail } from "@/auth/config";
import { supabaseConfig } from "@/lib/supabase/config";

export function entryConfig() {
  const landingOrigin = process.env.AUTH_LANDING_ORIGIN || "https://www.acetate.me";
  return {
    ...supabaseConfig(),
    landingOrigin,
    appOrigin: process.env.AUTH_APP_ORIGIN || "https://app.acetate.me",
    callbackUrl: process.env.AUTH_CALLBACK_URL || `${landingOrigin}/?auth=callback`,
    passkeysEnabled: process.env.AUTH_PASSKEYS_ENABLED !== "false",
  };
}

export async function authorizedIdentity(token: string) {
  if (!token) return false;
  const { url, publishableKey } = supabaseConfig();
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  return !error && Boolean(data.user?.email_confirmed_at) &&
    data.user?.email?.trim().toLowerCase() === allowedUserEmail();
}
