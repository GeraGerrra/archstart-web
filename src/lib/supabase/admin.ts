import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function requiredServerEnvironment(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SECRET_KEY"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

/**
 * Elevated server-only client for narrowly bounded persistence operations.
 * It never reads cookies and never adopts a learner session.
 */
export function createSecretSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = requiredServerEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requiredServerEnvironment("SUPABASE_SECRET_KEY");

  if (!secretKey.startsWith("sb_secret_")) {
    throw new Error("SUPABASE_SECRET_KEY must be a Supabase secret key.");
  }

  cachedClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}

/** Test-only reset. No secret value is returned or logged. */
export function resetSecretSupabaseClientForTests(): void {
  cachedClient = null;
}
