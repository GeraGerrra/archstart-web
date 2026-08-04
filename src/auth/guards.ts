import "server-only";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import type { ProfileRow } from "@/src/lib/supabase/database.types";
import { signInDestination } from "./redirects";
import type { AuthContext } from "./types";

export async function readProfileByUserId(userId: string): Promise<ProfileRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,first_name,last_name,discovery_source,onboarding_completed_at,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Не удалось загрузить профиль.");
  return data;
}

export async function requireAuth(nextPath: string): Promise<AuthContext> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
  if (error || !userId) redirect(signInDestination(nextPath));
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";
  const profile = await readProfileByUserId(userId);
  return { userId, email, profile };
}

export async function requireOnboardedProfile(nextPath: string): Promise<AuthContext & { profile: ProfileRow }> {
  const context = await requireAuth(nextPath);
  if (!context.profile?.onboarding_completed_at) redirect("/onboarding");
  return { ...context, profile: context.profile };
}
