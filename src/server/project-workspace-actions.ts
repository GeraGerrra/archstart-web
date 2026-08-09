"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { createSecretSupabaseClient } from "@/src/lib/supabase/admin";
import type {
  ProjectFileDownloadResult,
  ProjectFileFinalizationResult,
} from "@/src/project-upload/finalization-types";
import type { ProjectUploadCapabilityResult } from "@/src/project-upload/types";
import {
  PROJECT_FILE_LIMITS,
  PROJECT_UUID_PATTERN,
  exactObject,
  normalizeProjectCode,
} from "@/src/project-workspace/policy";
import type { ProjectWorkspaceMutationResult } from "@/src/project-workspace/types";
import { requestProjectFileDownloadAction } from "./project-file-download-action";
import { finalizeProjectUploadAction } from "./project-file-finalization-runtime";
import { requestProjectUploadCapabilityAction } from "./project-upload-capability-action";
import {
  authenticatedProjectSession as authenticatedSession,
  onboardedLearnerProjectSession,
  type OnboardedLearnerProjectSession,
} from "./project-workspace-session";

function success(message: string): ProjectWorkspaceMutationResult {
  return { status: "success", message };
}

function invalid(message: string): ProjectWorkspaceMutationResult {
  return { status: "invalid", message };
}

function rpcReturnedRow(data: unknown): boolean {
  const row = Array.isArray(data) ? data[0] : data;
  return Boolean(row && typeof row === "object" && !Array.isArray(row));
}

function learnerSessionFailure(
  session: Exclude<OnboardedLearnerProjectSession, { kind: "ready" }>,
): ProjectWorkspaceMutationResult {
  if (session.kind === "auth-required") {
    return { status: "auth-required", message: "Войдите в аккаунт." };
  }
  if (session.kind === "onboarding-required") {
    return { status: "denied", message: "Сначала завершите настройку профиля." };
  }
  return { status: "error", message: "Проверка профиля временно недоступна." };
}

async function activeStaffRole(
  userId: string,
  allowed: readonly ("reviewer" | "admin")[],
): Promise<"reviewer" | "admin" | null> {
  const secretClient = createSecretSupabaseClient();
  const { data, error } = await secretClient
    .schema("private")
    .from("project_staff_roles")
    .select("staff_role")
    .eq("user_id", userId)
    .eq("active", true)
    .in("staff_role", [...allowed]);
  if (error || !Array.isArray(data)) return null;
  const roles = new Set(data.map((row) => row?.staff_role));
  if (allowed.includes("admin") && roles.has("admin")) return "admin";
  if (allowed.includes("reviewer") && roles.has("reviewer")) return "reviewer";
  return null;
}

function refreshProjectRoutes(projectCode?: string): void {
  if (projectCode) {
    revalidatePath(`/prototype/a/course/${projectCode.slice(0, 3).toLowerCase()}/project`);
  }
  revalidatePath("/prototype/a/dashboard");
  revalidatePath("/prototype/a/review");
}

export async function finalizeProjectWorkspaceUploadAction(
  inputValue: unknown,
): Promise<ProjectFileFinalizationResult> {
  const session = await onboardedLearnerProjectSession();
  if (session.kind !== "ready") {
    if (session.kind === "auth-required") {
      return { status: "auth-required", message: "Войдите в аккаунт." };
    }
    return {
      status: session.kind === "onboarding-required" ? "denied" : "error",
      message: session.kind === "onboarding-required"
        ? "Сначала завершите настройку профиля."
        : "Проверка профиля временно недоступна.",
    };
  }
  return finalizeProjectUploadAction(inputValue);
}

export async function requestProjectWorkspaceUploadCapabilityAction(
  inputValue: unknown,
): Promise<ProjectUploadCapabilityResult> {
  const session = await onboardedLearnerProjectSession();
  if (session.kind !== "ready") {
    return {
      status: session.kind === "auth-required" ? "auth-required" : "error",
      message: session.kind === "auth-required"
        ? "Войдите в аккаунт, чтобы подготовить загрузку проекта."
        : session.kind === "onboarding-required"
          ? "Сначала завершите настройку профиля."
          : "Проверка профиля временно недоступна.",
    };
  }
  return requestProjectUploadCapabilityAction(inputValue);
}

export async function requestLearnerProjectFileDownloadAction(
  inputValue: unknown,
): Promise<ProjectFileDownloadResult> {
  const session = await onboardedLearnerProjectSession();
  if (session.kind !== "ready") {
    return {
      status: session.kind === "auth-required"
        ? "auth-required"
        : session.kind === "onboarding-required"
          ? "denied"
          : "error",
      message: session.kind === "auth-required"
        ? "Войдите в аккаунт, чтобы скачать файл."
        : session.kind === "onboarding-required"
          ? "Сначала завершите настройку профиля."
          : "Проверка профиля временно недоступна.",
    };
  }
  return requestProjectFileDownloadAction(inputValue);
}

export async function createProjectDraftAction(
  inputValue: unknown,
): Promise<ProjectWorkspaceMutationResult> {
  const session = await onboardedLearnerProjectSession();
  if (session.kind !== "ready") return learnerSessionFailure(session);
  const input = exactObject(inputValue, ["projectCode"]);
  const projectCode = normalizeProjectCode(input?.projectCode);
  if (!projectCode) return invalid("Код проекта не поддерживается.");
  try {
    const { data, error } = await session.client.rpc("create_project_draft", {
      p_project_code: projectCode,
    });
    if (error || !rpcReturnedRow(data)) {
      return { status: "error", message: "Не удалось создать черновик проекта." };
    }
    refreshProjectRoutes(projectCode);
    return success("Черновик проекта создан.");
  } catch {
    return { status: "error", message: "Создание черновика временно недоступно." };
  }
}

export async function updateProjectDraftAction(
  inputValue: unknown,
): Promise<ProjectWorkspaceMutationResult> {
  const session = await onboardedLearnerProjectSession();
  if (session.kind !== "ready") return learnerSessionFailure(session);
  const input = exactObject(inputValue, ["versionId", "learnerNote", "supportingText"]);
  const versionId = typeof input?.versionId === "string" && PROJECT_UUID_PATTERN.test(input.versionId)
    ? input.versionId
    : null;
  const learnerNote = typeof input?.learnerNote === "string" ? input.learnerNote.trim() : null;
  const supportingText = typeof input?.supportingText === "string" ? input.supportingText.trim() : null;
  if (
    !versionId
    || learnerNote === null
    || supportingText === null
    || learnerNote.length > PROJECT_FILE_LIMITS.noteMaximumCharacters
    || supportingText.length > PROJECT_FILE_LIMITS.supportingTextMaximumCharacters
  ) return invalid("Проверьте заметку и сопроводительный текст.");
  try {
    const { data, error } = await session.client.rpc("update_project_draft", {
      p_version_id: versionId,
      p_learner_note: learnerNote || null,
      p_supporting_text: supportingText || null,
    });
    if (error || !rpcReturnedRow(data)) {
      return { status: "error", message: "Не удалось сохранить черновик." };
    }
    refreshProjectRoutes();
    return success("Черновик сохранён.");
  } catch {
    return { status: "error", message: "Сохранение временно недоступно." };
  }
}

async function versionWorkflowAction(
  inputValue: unknown,
  rpcName: "submit_project" | "resubmit_project",
  successMessage: string,
): Promise<ProjectWorkspaceMutationResult> {
  const session = await onboardedLearnerProjectSession();
  if (session.kind !== "ready") return learnerSessionFailure(session);
  const input = exactObject(inputValue, ["versionId"]);
  const versionId = typeof input?.versionId === "string" && PROJECT_UUID_PATTERN.test(input.versionId)
    ? input.versionId
    : null;
  if (!versionId) return invalid("Версия проекта не распознана.");
  try {
    const { data, error } = await session.client.rpc(rpcName, {
      p_version_id: versionId,
    });
    if (error || !rpcReturnedRow(data)) {
      return {
        status: "error",
        message: "Сервер не подтвердил готовность проекта. Проверьте 5 уроков, файл и текст.",
      };
    }
    refreshProjectRoutes();
    return success(successMessage);
  } catch {
    return { status: "error", message: "Отправка проекта временно недоступна." };
  }
}

export async function submitProjectAction(
  inputValue: unknown,
): Promise<ProjectWorkspaceMutationResult> {
  return versionWorkflowAction(inputValue, "submit_project", "Проект отправлен на проверку.");
}

export async function resubmitProjectAction(
  inputValue: unknown,
): Promise<ProjectWorkspaceMutationResult> {
  return versionWorkflowAction(inputValue, "resubmit_project", "Новая версия отправлена повторно.");
}

export async function createProjectRevisionDraftAction(
  inputValue: unknown,
): Promise<ProjectWorkspaceMutationResult> {
  const session = await onboardedLearnerProjectSession();
  if (session.kind !== "ready") return learnerSessionFailure(session);
  const input = exactObject(inputValue, ["submissionId"]);
  const submissionId = typeof input?.submissionId === "string"
    && PROJECT_UUID_PATTERN.test(input.submissionId)
    ? input.submissionId
    : null;
  if (!submissionId) return invalid("Проект не распознан.");
  try {
    const { data, error } = await session.client.rpc("create_project_revision_draft", {
      p_submission_id: submissionId,
    });
    if (error || !rpcReturnedRow(data)) {
      return { status: "error", message: "Не удалось создать новую версию." };
    }
    refreshProjectRoutes();
    return success("Черновик новой версии создан.");
  } catch {
    return { status: "error", message: "Новая версия временно недоступна." };
  }
}

export async function assignProjectReviewerAction(
  inputValue: unknown,
): Promise<ProjectWorkspaceMutationResult> {
  const input = exactObject(inputValue, ["submissionId", "reviewerId"]);
  const submissionId = typeof input?.submissionId === "string"
    && PROJECT_UUID_PATTERN.test(input.submissionId) ? input.submissionId : null;
  const reviewerId = typeof input?.reviewerId === "string"
    && PROJECT_UUID_PATTERN.test(input.reviewerId) ? input.reviewerId : null;
  if (!submissionId || !reviewerId) return invalid("Выберите проект и проверяющего.");
  const session = await authenticatedSession();
  if (!session) return { status: "auth-required", message: "Войдите в аккаунт." };
  if (await activeStaffRole(session.userId, ["admin"]) !== "admin") {
    return { status: "denied", message: "Назначение доступно только администратору." };
  }
  try {
    const { data, error } = await session.client.rpc("assign_project_reviewer", {
      p_submission_id: submissionId,
      p_reviewer_id: reviewerId,
    });
    if (error || !rpcReturnedRow(data)) {
      return { status: "error", message: "Не удалось назначить проверяющего." };
    }
    refreshProjectRoutes();
    return success("Проверяющий назначен.");
  } catch {
    return { status: "error", message: "Назначение временно недоступно." };
  }
}

export async function beginProjectReviewAction(
  inputValue: unknown,
): Promise<ProjectWorkspaceMutationResult> {
  const input = exactObject(inputValue, ["submissionId"]);
  const submissionId = typeof input?.submissionId === "string"
    && PROJECT_UUID_PATTERN.test(input.submissionId) ? input.submissionId : null;
  if (!submissionId) return invalid("Проект не распознан.");
  const session = await authenticatedSession();
  if (!session) return { status: "auth-required", message: "Войдите в аккаунт." };
  if (!await activeStaffRole(session.userId, ["reviewer", "admin"])) {
    return { status: "denied", message: "Проверка проекта недоступна." };
  }
  try {
    const { data, error } = await session.client.rpc("begin_project_review", {
      p_submission_id: submissionId,
    });
    if (error || !rpcReturnedRow(data)) {
      return { status: "error", message: "Не удалось начать проверку." };
    }
    refreshProjectRoutes();
    return success("Проверка начата.");
  } catch {
    return { status: "error", message: "Проверка временно недоступна." };
  }
}

export async function decideProjectReviewAction(
  inputValue: unknown,
): Promise<ProjectWorkspaceMutationResult> {
  const input = exactObject(inputValue, ["submissionId", "decision", "summary", "criteria"]);
  const submissionId = typeof input?.submissionId === "string"
    && PROJECT_UUID_PATTERN.test(input.submissionId) ? input.submissionId : null;
  const decision = input?.decision;
  const summary = typeof input?.summary === "string" ? input.summary.trim() : "";
  const criteria = Array.isArray(input?.criteria) ? input.criteria : [];
  if (
    !submissionId
    || (decision !== "revisions_required" && decision !== "accepted" && decision !== "not_accepted")
    || summary.length < 1
    || summary.length > 5_000
    || criteria.length !== 5
  ) return invalid("Заполните итог проверки и выберите решение.");
  const normalizedCriteria = criteria.map((value, index) => {
    const criterion = exactObject(value, ["criterion_number", "awarded_points", "comment"]);
    const criterionNumber = criterion?.criterion_number;
    const awardedPoints = criterion?.awarded_points;
    const comment = typeof criterion?.comment === "string" ? criterion.comment.trim() : null;
    if (
      criterionNumber !== index + 1
      || typeof awardedPoints !== "number"
      || !Number.isSafeInteger(awardedPoints)
      || awardedPoints < 0
      || awardedPoints > 100
      || comment === null
      || comment.length > 2_000
    ) return null;
    return {
      criterion_number: criterionNumber,
      awarded_points: awardedPoints,
      comment: comment || null,
    };
  });
  if (normalizedCriteria.some((criterion) => criterion === null)) {
    return invalid("Баллы должны быть целыми и соответствовать пяти критериям.");
  }
  const session = await authenticatedSession();
  if (!session) return { status: "auth-required", message: "Войдите в аккаунт." };
  if (!await activeStaffRole(session.userId, ["reviewer", "admin"])) {
    return { status: "denied", message: "Решение по проекту недоступно." };
  }
  try {
    const { data, error } = await session.client.rpc("decide_project_review", {
      p_submission_id: submissionId,
      p_decision: decision,
      p_summary: summary,
      p_criteria: normalizedCriteria,
    });
    if (error || !rpcReturnedRow(data)) {
      return { status: "error", message: "Сервер не принял решение по проекту." };
    }
    refreshProjectRoutes();
    return success("Решение сохранено и отправлено учащемуся.");
  } catch {
    return { status: "error", message: "Решение временно не удалось сохранить." };
  }
}
