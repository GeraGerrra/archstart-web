import "server-only";

import type { CompletionDemoState } from "@/src/completion/types";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

const LESSON_CODE_PATTERN = /^M0[1-8]_L0[1-5]$/u;
const MODULE_CODE_PATTERN = /^M0[1-8]$/u;

type SessionClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

interface AuthenticatedSession {
  client: SessionClient;
  userId: string;
}

export interface LessonCompletionSnapshot {
  authenticated: boolean;
  state: CompletionDemoState;
  hasQuizAttempt: boolean;
}

export interface ModuleCompletionSnapshot {
  authenticated: boolean;
  state: CompletionDemoState;
  completedLessonCodes: readonly string[];
}

async function authenticatedSession(): Promise<AuthenticatedSession | null> {
  const client = await createServerSupabaseClient();
  const { data: claimsResult, error: claimsError } = await client.auth.getClaims();
  const userId = typeof claimsResult?.claims?.sub === "string" ? claimsResult.claims.sub : "";

  if (claimsError || !userId) return null;
  return { client, userId };
}

function lessonCodesForModule(moduleCode: string): readonly string[] {
  return Array.from(
    { length: 5 },
    (_, index) => `${moduleCode}_L${String(index + 1).padStart(2, "0")}`,
  );
}

export async function loadLessonCompletionSnapshot(
  lessonCode: string,
): Promise<LessonCompletionSnapshot> {
  const normalizedLessonCode = lessonCode.toUpperCase();
  if (!LESSON_CODE_PATTERN.test(normalizedLessonCode)) {
    return { authenticated: false, state: "locked", hasQuizAttempt: false };
  }

  const session = await authenticatedSession();
  if (!session) {
    return { authenticated: false, state: "locked", hasQuizAttempt: false };
  }

  const [attemptResult, completionResult] = await Promise.all([
    session.client
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("lesson_code", normalizedLessonCode),
    session.client
      .from("lesson_completions")
      .select("lesson_code", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("lesson_code", normalizedLessonCode),
  ]);

  if (attemptResult.error || completionResult.error) {
    return { authenticated: true, state: "locked", hasQuizAttempt: false };
  }

  const hasQuizAttempt = (attemptResult.count ?? 0) > 0;
  const complete = (completionResult.count ?? 0) > 0;

  return {
    authenticated: true,
    state: complete ? "complete" : hasQuizAttempt ? "ready" : "locked",
    hasQuizAttempt,
  };
}

export async function loadModuleCompletionSnapshot(
  moduleCode: string,
): Promise<ModuleCompletionSnapshot> {
  const normalizedModuleCode = moduleCode.toUpperCase();
  if (!MODULE_CODE_PATTERN.test(normalizedModuleCode)) {
    return { authenticated: false, state: "locked", completedLessonCodes: [] };
  }

  const session = await authenticatedSession();
  if (!session) {
    return { authenticated: false, state: "locked", completedLessonCodes: [] };
  }

  const requiredLessonCodes = lessonCodesForModule(normalizedModuleCode);
  const [lessonsResult, moduleResult] = await Promise.all([
    session.client
      .from("lesson_completions")
      .select("lesson_code")
      .eq("user_id", session.userId)
      .in("lesson_code", [...requiredLessonCodes]),
    session.client
      .from("module_completions")
      .select("module_code", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("module_code", normalizedModuleCode),
  ]);

  if (lessonsResult.error || moduleResult.error) {
    return { authenticated: true, state: "locked", completedLessonCodes: [] };
  }

  const completedLessonCodes = [...new Set(
    (lessonsResult.data ?? [])
      .map((row) => row.lesson_code)
      .filter((value): value is string => typeof value === "string"),
  )].sort();
  const allLessonsComplete = completedLessonCodes.length === requiredLessonCodes.length;
  const moduleComplete = (moduleResult.count ?? 0) > 0;

  return {
    authenticated: true,
    state: moduleComplete && allLessonsComplete
      ? "complete"
      : allLessonsComplete
        ? "ready"
        : "locked",
    completedLessonCodes,
  };
}
