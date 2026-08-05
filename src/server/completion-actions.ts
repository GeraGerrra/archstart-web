"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import type {
  CompletionDemoState,
  CompletionMutationResult,
} from "@/src/completion/types";
import { createSecretSupabaseClient } from "@/src/lib/supabase/admin";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

const LESSON_CODE_PATTERN = /^M0[1-8]_L0[1-5]$/u;
const MODULE_CODE_PATTERN = /^M0[1-8]$/u;

type SessionClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

interface AuthenticatedContext {
  client: SessionClient;
  userId: string;
}

interface CountResult {
  count: number;
  failed: boolean;
}

function result(
  status: CompletionMutationResult["status"],
  state: CompletionDemoState,
  message: string,
): CompletionMutationResult {
  return { status, state, message };
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return typeof error.code === "string" ? error.code : "";
}

async function authenticatedContext(): Promise<AuthenticatedContext | null> {
  const client = await createServerSupabaseClient();
  const { data: claimsResult, error: claimsError } = await client.auth.getClaims();
  const userId = typeof claimsResult?.claims?.sub === "string" ? claimsResult.claims.sub : "";

  if (claimsError || !userId) return null;
  return { client, userId };
}

async function ownRowCount(
  client: SessionClient,
  table: "quiz_attempts" | "lesson_completions" | "module_completions",
  userId: string,
  codeColumn: "lesson_code" | "module_code",
  code: string,
): Promise<CountResult> {
  const response = await client
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq(codeColumn, code);

  return {
    count: response.count ?? 0,
    failed: Boolean(response.error),
  };
}

async function completedLessonCount(
  client: SessionClient,
  userId: string,
  moduleCode: string,
): Promise<CountResult> {
  const lessonCodes = Array.from(
    { length: 5 },
    (_, index) => `${moduleCode}_L${String(index + 1).padStart(2, "0")}`,
  );
  const response = await client
    .from("lesson_completions")
    .select("lesson_code")
    .eq("user_id", userId)
    .in("lesson_code", lessonCodes);

  if (response.error) return { count: 0, failed: true };
  return {
    count: new Set(
      (response.data ?? [])
        .map((row) => row.lesson_code)
        .filter((value): value is string => typeof value === "string"),
    ).size,
    failed: false,
  };
}

function moduleRoute(moduleCode: string): string {
  return `/prototype/a/course/${moduleCode.toLowerCase()}`;
}

function lessonQuizRoute(lessonCode: string): string {
  const moduleCode = lessonCode.slice(0, 3);
  const lessonSlug = lessonCode.slice(4).toLowerCase();
  return `${moduleRoute(moduleCode)}/${lessonSlug}/quiz`;
}

function revalidateLessonCompletionPaths(lessonCode: string): void {
  revalidatePath(lessonQuizRoute(lessonCode));
  revalidatePath(moduleRoute(lessonCode.slice(0, 3)));
}

function revalidateModuleCompletionPath(moduleCode: string): void {
  revalidatePath(moduleRoute(moduleCode));
}

export async function completeLessonCompletionAction(
  lessonCode: string,
): Promise<CompletionMutationResult> {
  const normalizedLessonCode = lessonCode.toUpperCase();
  if (!LESSON_CODE_PATTERN.test(normalizedLessonCode)) {
    return result("invalid", "locked", "Не удалось распознать урок.");
  }

  const auth = await authenticatedContext();
  if (!auth) {
    return result("auth-required", "locked", "Войдите в аккаунт, чтобы завершить урок.");
  }

  const existing = await ownRowCount(
    auth.client,
    "lesson_completions",
    auth.userId,
    "lesson_code",
    normalizedLessonCode,
  );
  if (existing.failed) {
    return result("error", "locked", "Не удалось проверить состояние урока.");
  }
  if (existing.count > 0) {
    return result("success", "complete", "Урок уже отмечен завершённым.");
  }

  const attempts = await ownRowCount(
    auth.client,
    "quiz_attempts",
    auth.userId,
    "lesson_code",
    normalizedLessonCode,
  );
  if (attempts.failed) {
    return result("error", "locked", "Не удалось проверить попытку квиза.");
  }
  if (attempts.count < 1) {
    return result("invalid", "locked", "Сначала сохраните попытку квиза этого урока.");
  }

  const secretClient = createSecretSupabaseClient();
  const { error } = await secretClient
    .from("lesson_completions")
    .insert({
      user_id: auth.userId,
      lesson_code: normalizedLessonCode,
    });

  if (error && errorCode(error) !== "23505") {
    if (errorCode(error) === "23514") {
      return result("invalid", "locked", "Сначала сохраните попытку квиза этого урока.");
    }
    return result("error", "ready", "Не удалось отметить урок завершённым.");
  }

  revalidateLessonCompletionPaths(normalizedLessonCode);
  return result("success", "complete", "Урок отмечен завершённым.");
}

export async function undoLessonCompletionAction(
  lessonCode: string,
): Promise<CompletionMutationResult> {
  const normalizedLessonCode = lessonCode.toUpperCase();
  if (!LESSON_CODE_PATTERN.test(normalizedLessonCode)) {
    return result("invalid", "locked", "Не удалось распознать урок.");
  }

  const auth = await authenticatedContext();
  if (!auth) {
    return result("auth-required", "locked", "Войдите в аккаунт, чтобы изменить отметку урока.");
  }

  const attempts = await ownRowCount(
    auth.client,
    "quiz_attempts",
    auth.userId,
    "lesson_code",
    normalizedLessonCode,
  );
  const nextState: CompletionDemoState = !attempts.failed && attempts.count > 0
    ? "ready"
    : "locked";

  const secretClient = createSecretSupabaseClient();
  const { error } = await secretClient
    .from("lesson_completions")
    .delete()
    .eq("user_id", auth.userId)
    .eq("lesson_code", normalizedLessonCode);

  if (error) {
    return result("error", "complete", "Не удалось снять отметку урока.");
  }

  revalidateLessonCompletionPaths(normalizedLessonCode);
  return result(
    "success",
    nextState,
    nextState === "ready"
      ? "Отметка урока снята. Попытка квиза сохранена."
      : "Отметка урока снята.",
  );
}

export async function completeModuleCompletionAction(
  moduleCode: string,
): Promise<CompletionMutationResult> {
  const normalizedModuleCode = moduleCode.toUpperCase();
  if (!MODULE_CODE_PATTERN.test(normalizedModuleCode)) {
    return result("invalid", "locked", "Не удалось распознать модуль.");
  }

  const auth = await authenticatedContext();
  if (!auth) {
    return result("auth-required", "locked", "Войдите в аккаунт, чтобы завершить модуль.");
  }

  const existing = await ownRowCount(
    auth.client,
    "module_completions",
    auth.userId,
    "module_code",
    normalizedModuleCode,
  );
  if (existing.failed) {
    return result("error", "locked", "Не удалось проверить состояние модуля.");
  }
  if (existing.count > 0) {
    return result("success", "complete", "Модуль уже отмечен завершённым.");
  }

  const lessons = await completedLessonCount(auth.client, auth.userId, normalizedModuleCode);
  if (lessons.failed) {
    return result("error", "locked", "Не удалось проверить завершённые уроки.");
  }
  if (lessons.count !== 5) {
    return result("invalid", "locked", "Завершите все пять уроков модуля.");
  }

  const secretClient = createSecretSupabaseClient();
  const { error } = await secretClient
    .from("module_completions")
    .insert({
      user_id: auth.userId,
      module_code: normalizedModuleCode,
    });

  if (error && errorCode(error) !== "23505") {
    if (errorCode(error) === "23514") {
      return result("invalid", "locked", "Завершите все пять уроков модуля.");
    }
    return result("error", "ready", "Не удалось отметить модуль завершённым.");
  }

  revalidateModuleCompletionPath(normalizedModuleCode);
  return result("success", "complete", `Модуль ${normalizedModuleCode.slice(1)} отмечен завершённым.`);
}

export async function undoModuleCompletionAction(
  moduleCode: string,
): Promise<CompletionMutationResult> {
  const normalizedModuleCode = moduleCode.toUpperCase();
  if (!MODULE_CODE_PATTERN.test(normalizedModuleCode)) {
    return result("invalid", "locked", "Не удалось распознать модуль.");
  }

  const auth = await authenticatedContext();
  if (!auth) {
    return result("auth-required", "locked", "Войдите в аккаунт, чтобы изменить отметку модуля.");
  }

  const lessons = await completedLessonCount(auth.client, auth.userId, normalizedModuleCode);
  const nextState: CompletionDemoState = !lessons.failed && lessons.count === 5
    ? "ready"
    : "locked";

  const secretClient = createSecretSupabaseClient();
  const { error } = await secretClient
    .from("module_completions")
    .delete()
    .eq("user_id", auth.userId)
    .eq("module_code", normalizedModuleCode);

  if (error) {
    return result("error", "complete", "Не удалось снять отметку модуля.");
  }

  revalidateModuleCompletionPath(normalizedModuleCode);
  return result("success", nextState, "Отметка модуля снята.");
}
