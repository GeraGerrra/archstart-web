"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/src/auth/config";

export function createBrowserSupabaseClient() {
  const config = getPublicSupabaseConfig();
  return createBrowserClient(config.url, config.publishableKey);
}
