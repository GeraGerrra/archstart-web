import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseConfig } from "@/src/auth/config";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const config = getPublicSupabaseConfig();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot write cookies. Root proxy.ts owns refresh writes.
        }
      },
    },
  });
}
