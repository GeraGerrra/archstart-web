"use server";

import "server-only";

import { createSecretSupabaseClient } from "@/src/lib/supabase/admin";
import { inspectProjectFile, validateProjectFilePolicy } from "@/src/project-upload/file-inspection";
import {
  PROJECT_FILE_FINALIZATION_LIMITS,
  PROJECT_FILE_REJECTION_REASONS,
  type ProjectFileDetectedMime,
  type ProjectFileFinalizationResult,
  type ProjectFilePolicySnapshot,
  type ProjectFileRejectionReason,
} from "@/src/project-upload/finalization-types";
import {
  PROJECT_UUID_PATTERN,
  authenticatedProjectUserId,
  canonicalProjectObjectPath,
  exactUuidInput,
  oneRow,
  plainRecord,
  storageErrorIsMissing,
} from "./project-file-finalization-shared";

interface InspectionContext {
  contextStatus: "inspect";
  intentId: string;
  plannedFileId: string;
  userId: string;
  submissionId: string;
  versionId: string;
  bucketId: "project-submissions";
  objectPath: string;
  declaredMime: ProjectFileDetectedMime;
  declaredSizeBytes: number;
  policy: ProjectFilePolicySnapshot;
}

type FinalizationContext =
  | InspectionContext
  | {
      contextStatus: "finalized";
      intentId: string;
      plannedFileId: string;
    }
  | {
      contextStatus: "cleanup_expired" | "cleanup_inconsistent";
      intentId: string;
      plannedFileId: string;
      userId: string;
      submissionId: string;
      versionId: string;
      bucketId: "project-submissions";
      objectPath: string;
      declaredMime: ProjectFileDetectedMime;
    }
  | { contextStatus: "blocked"; intentId: string; plannedFileId: string };

function safeInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum;
}

function stringArray(value: unknown): ProjectFileDetectedMime[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) return null;
  if (!value.every((item) => item === "application/pdf" || item === "image/png")) {
    return null;
  }
  return [...value] as ProjectFileDetectedMime[];
}

function parseFinalizationContext(value: unknown): FinalizationContext | null {
  const row = plainRecord(oneRow(value));
  if (!row) return null;
  const contextStatus = row.context_status;
  const intentId = row.intent_id;
  const plannedFileId = row.planned_file_id;
  if (
    typeof contextStatus !== "string"
    || typeof intentId !== "string"
    || typeof plannedFileId !== "string"
    || !PROJECT_UUID_PATTERN.test(intentId)
    || !PROJECT_UUID_PATTERN.test(plannedFileId)
  ) return null;

  if (contextStatus === "finalized" || contextStatus === "blocked") {
    return { contextStatus, intentId, plannedFileId };
  }

  if (
    contextStatus !== "inspect"
    && contextStatus !== "cleanup_expired"
    && contextStatus !== "cleanup_inconsistent"
  ) return null;

  const userId = row.user_id;
  const submissionId = row.submission_id;
  const versionId = row.version_id;
  const bucketId = row.bucket_id;
  const objectPath = row.object_path;
  const declaredMime = row.declared_mime;
  if (
    typeof userId !== "string"
    || typeof submissionId !== "string"
    || typeof versionId !== "string"
    || bucketId !== "project-submissions"
    || typeof objectPath !== "string"
    || (declaredMime !== "application/pdf" && declaredMime !== "image/png")
    || canonicalProjectObjectPath({
      userId,
      submissionId,
      versionId,
      plannedFileId,
      declaredMime,
    }) !== objectPath
  ) return null;

  if (contextStatus !== "inspect") {
    return {
      contextStatus,
      intentId,
      plannedFileId,
      userId,
      submissionId,
      versionId,
      bucketId,
      objectPath,
      declaredMime,
    };
  }

  const allowedMimeTypes = stringArray(row.allowed_mime_types);
  const formatType = row.format_type;
  if (
    !safeInteger(
      row.declared_size_bytes,
      PROJECT_FILE_FINALIZATION_LIMITS.minimumBytes,
      PROJECT_FILE_FINALIZATION_LIMITS.maximumBytes,
    )
    || !allowedMimeTypes
    || (formatType !== "SINGLE_BOARD" && formatType !== "MULTI_PAGE_PACK")
    || !safeInteger(row.max_file_bytes, 1, PROJECT_FILE_FINALIZATION_LIMITS.maximumBytes)
    || !safeInteger(row.expected_width, 1, 100_000)
    || !safeInteger(row.expected_height, 1, 100_000)
    || !safeInteger(row.min_page_count, 1, 1_000)
    || !safeInteger(row.max_page_count, 1, 1_000)
  ) return null;

  return {
    contextStatus,
    intentId,
    plannedFileId,
    userId,
    submissionId,
    versionId,
    bucketId,
    objectPath,
    declaredMime,
    declaredSizeBytes: row.declared_size_bytes,
    policy: {
      declaredMime,
      declaredSizeBytes: row.declared_size_bytes,
      formatType,
      allowedMimeTypes,
      maxFileBytes: row.max_file_bytes,
      expectedWidth: row.expected_width,
      expectedHeight: row.expected_height,
      minPageCount: row.min_page_count,
      maxPageCount: row.max_page_count,
    },
  };
}

function rejectionMessage(reason: ProjectFileRejectionReason): string {
  if (reason === "invalid_png_dimensions") {
    return "PNG должен иметь точный размер 1920 × 1080 пикселей.";
  }
  if (reason === "invalid_pdf_page_count") {
    return "Количество страниц PDF не соответствует правилам проекта.";
  }
  return "Файл не прошёл безопасную проверку. Загрузите исправленный файл.";
}

async function cleanupAndClose(
  intentId: string,
  requesterId: string,
  objectPath: string,
  reason: ProjectFileRejectionReason,
): Promise<ProjectFileFinalizationResult> {
  const secretClient = createSecretSupabaseClient();
  const { error: removeError } = await secretClient.storage
    .from("project-submissions")
    .remove([objectPath]);
  if (removeError) {
    return {
      status: "cleanup-failed",
      reason,
      message: "Не удалось безопасно удалить отклонённый объект. Повторите позже.",
    };
  }

  const closeState = reason === "expired_before_finalization" ? "expired" : "rejected";
  const { error: closeError } = await secretClient.rpc(
    "close_project_upload_intent_after_inspection",
    {
      p_intent_id: intentId,
      p_requester_id: requesterId,
      p_close_state: closeState,
      p_reason: reason,
    },
  );
  if (closeError) {
    return {
      status: "cleanup-failed",
      reason,
      message: "Объект удалён, но состояние загрузки не удалось закрыть.",
    };
  }
  return { status: "rejected", reason, message: rejectionMessage(reason) };
}

function parseFinalizedRow(value: unknown, expectedIntentId: string): {
  fileId: string;
  reused: boolean;
} | null {
  const row = plainRecord(oneRow(value));
  if (
    !row
    || row.intent_id !== expectedIntentId
    || typeof row.file_id !== "string"
    || !PROJECT_UUID_PATTERN.test(row.file_id)
    || typeof row.reused !== "boolean"
    || row.intent_state !== "finalized"
  ) return null;
  return { fileId: row.file_id, reused: row.reused };
}

export async function finalizeProjectUploadAction(
  inputValue: unknown,
): Promise<ProjectFileFinalizationResult> {
  const intentId = exactUuidInput(inputValue, "intentId");
  if (!intentId) {
    return { status: "invalid", message: "Передайте только корректный идентификатор загрузки." };
  }

  const requesterId = await authenticatedProjectUserId();
  if (!requesterId) {
    return { status: "auth-required", message: "Войдите в аккаунт, чтобы завершить загрузку." };
  }

  try {
    const secretClient = createSecretSupabaseClient();
    const { data: contextData, error: contextError } = await secretClient.rpc(
      "get_project_upload_finalization_context",
      { p_intent_id: intentId, p_requester_id: requesterId },
    );
    if (contextError) {
      return { status: "error", message: "Проверка загрузки временно недоступна." };
    }
    const context = parseFinalizationContext(contextData);
    if (!context) {
      return { status: "denied", message: "Загрузка недоступна или уже закрыта." };
    }
    if (context.contextStatus === "finalized") {
      return {
        status: "success",
        fileId: context.plannedFileId,
        reused: true,
        message: "Файл уже был безопасно принят.",
      };
    }
    if (context.contextStatus === "blocked") {
      return { status: "denied", message: "Загрузка недоступна или уже закрыта." };
    }
    if (context.contextStatus !== "inspect") {
      return cleanupAndClose(
        context.intentId,
        requesterId,
        context.objectPath,
        context.contextStatus === "cleanup_expired"
          ? "expired_before_finalization"
          : "inconsistent_finalization_context",
      );
    }

    const { data: object, error: downloadError } = await secretClient.storage
      .from(context.bucketId)
      .download(context.objectPath);
    if (downloadError || !object) {
      if (storageErrorIsMissing(downloadError)) {
        return cleanupAndClose(
          context.intentId,
          requesterId,
          context.objectPath,
          "object_missing",
        );
      }
      return { status: "error", message: "Не удалось получить приватный объект для проверки." };
    }

    if (
      object.size < PROJECT_FILE_FINALIZATION_LIMITS.minimumBytes
      || object.size > PROJECT_FILE_FINALIZATION_LIMITS.maximumBytes
    ) {
      return cleanupAndClose(
        context.intentId,
        requesterId,
        context.objectPath,
        "object_size_out_of_bounds",
      );
    }
    if (object.size !== context.declaredSizeBytes) {
      return cleanupAndClose(
        context.intentId,
        requesterId,
        context.objectPath,
        "declared_size_mismatch",
      );
    }

    const bytes = new Uint8Array(await object.arrayBuffer());
    const inspection = await inspectProjectFile(bytes);
    if (!inspection.ok) {
      return cleanupAndClose(
        context.intentId,
        requesterId,
        context.objectPath,
        inspection.reason,
      );
    }
    const policyResult = validateProjectFilePolicy(inspection, context.policy);
    if (!policyResult.ok) {
      return cleanupAndClose(
        context.intentId,
        requesterId,
        context.objectPath,
        policyResult.reason,
      );
    }

    const { data: finalData, error: finalError } = await secretClient.rpc(
      "finalize_project_upload_intent",
      {
        p_intent_id: context.intentId,
        p_requester_id: requesterId,
        p_sha256: inspection.sha256,
        p_actual_size_bytes: inspection.sizeBytes,
        p_detected_mime: inspection.detectedMime,
        p_page_count: inspection.pageCount,
        p_pixel_width: inspection.pixelWidth,
        p_pixel_height: inspection.pixelHeight,
      },
    );
    if (finalError) {
      return { status: "error", message: "Файл проверен, но финализация не завершилась." };
    }
    const finalized = parseFinalizedRow(finalData, context.intentId);
    if (!finalized) {
      return { status: "error", message: "Сервер вернул некорректный результат финализации." };
    }
    return {
      status: "success",
      fileId: finalized.fileId,
      reused: finalized.reused,
      message: finalized.reused ? "Файл уже был безопасно принят." : "Файл проверен и принят.",
    };
  } catch {
    return { status: "error", message: "Завершение загрузки временно недоступно." };
  }
}

export function isStableProjectFileRejectionReason(
  value: unknown,
): value is ProjectFileRejectionReason {
  return typeof value === "string"
    && PROJECT_FILE_REJECTION_REASONS.includes(value as ProjectFileRejectionReason);
}
