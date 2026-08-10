import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { PROJECT_UUID_PATTERN } from "@/src/project-workspace/policy";

type SessionClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type AuthenticatedProjectSession = {
  kind: "authenticated";
  client: SessionClient;
  userId: string;
};

export type OnboardedLearnerProjectSession =
  | {
      kind: "ready";
      client: SessionClient;
      userId: string;
    }
  | { kind: "auth-required" }
  | { kind: "onboarding-required" }
  | { kind: "error" };

export async function authenticatedProjectSession(): Promise<
  AuthenticatedProjectSession | null
> {
  try {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.auth.getClaims();
    const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
    return !error && PROJECT_UUID_PATTERN.test(userId)
      ? { kind: "authenticated", client, userId }
      : null;
  } catch {
    return null;
  }
}

export async function onboardedLearnerProjectSession(): Promise<
  OnboardedLearnerProjectSession
> {
  const session = await authenticatedProjectSession();
  if (!session) return { kind: "auth-required" };

  try {
    const { data, error } = await session.client
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("user_id", session.userId)
      .maybeSingle();
    if (error) return { kind: "error" };
    if (!data?.onboarding_completed_at) return { kind: "onboarding-required" };
    return { kind: "ready", client: session.client, userId: session.userId };
  } catch {
    return { kind: "error" };
  }
}
