import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY Supabase client using the service_role key.
 *
 * This key BYPASSES Row-Level Security and can use the Auth Admin API
 * (create users, etc.). NEVER import this into a client component and never
 * expose the key to the browser. Only call it from server actions / route
 * handlers that have already verified the caller is an admin.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (Dashboard → Project Settings → API Keys → service_role) to enable admin user management.",
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Is the service_role key configured? Used to show a setup hint in the UI. */
export function hasServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
