"use server";

import "server-only";

import { createSecretSupabaseClient } from "@/src/lib/supabase/admin";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import {
  PROJECT_UPLOAD_BUCKET_ID,
  PROJECT_UPLOAD_CAPABILITY_LIMITS,
  PROJECT_UPLOAD_MIME_TYPES,
  type ProjectUploadCapabilityInput,
  type ProjectUploadCapabilityResult,
  type ProjectUploadMime,
  type ProjectUploadTransferMode,
} from "@/src/project-upload/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type SessionClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

interface UploadIntentRow {
  intent_id: string;
  planned_file_id: string;
  submission_id: string;
  version_id: string;
  bucket_id: string;
  object_path: string;
  original_filename: string;
  declared_mime: string;
  declared_size_bytes: number;
  transfer_mode: string;
  intent_state: string;
  expires_at: string;
  reused: boolean;
}

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeInput(value: unknown): ProjectUploadCapabilityInput | null {
  const record = plainRecord(value);
  if (!record) return null;

  const versionId = typeof record.versionId === "string" ? record.versionId.trim() : "";
  const originalFilename = typeof record.originalFilename === "string"
    ? record.originalFilename.trim()
    : "";
  const declaredMime = typeof record.declaredMime === "string"
    ? record.declaredMime.trim().toLowerCase()
    : "";
  const declaredSizeBytes = record.declaredSizeBytes;

  if (!UUID_PATTERN.test(versionId)) return null;
  if (
    originalFilename.length < 1
    || originalFilename.length
      > PROJECT_UPLOAD_CAPABILITY_LIMITS.originalFilenameMaximumCharacters
    || originalFilename.includes("/")
    || originalFilename.includes("\\")
  ) {
    return null;
  }
  if (!PROJECT_UPLOAD_MIME_TYPES.includes(declaredMime as ProjectUploadMime)) return null;
  if (
    typeof declaredSizeBytes !== "number"
    || !Number.isSafeInteger(declaredSizeBytes)
    || declaredSizeBytes < PROJECT_UPLOAD_CAPABILITY_LIMITS.minimumBytes
    || declaredSizeBytes > PROJECT_UPLOAD_CAPABILITY_LIMITS.absoluteMaximumBytes
  ) {
    return null;
  }

  const extension = declaredMime === "application/pdf" ? ".pdf" : ".png";
  if (!originalFilename.toLowerCase().endsWith(extension)) return null;

  return {
    versionId,
    originalFilename,
    declaredMime: declaredMime as ProjectUploadMime,
    declaredSizeBytes,
  };
}

function firstRpcRow(data: unknown): unknown {
  if (Array.isArray(data)) return data.length === 1 ? data[0] : null;
  return data;
}

function validIntentRow(
  value: unknown,
  input: ProjectUploadCapabilityInput,
  userId: string,
): value is UploadIntentRow {
  const row = plainRecord(value);
  if (!row) return false;

  return typeof row.intent_id === "string"
    && UUID_PATTERN.test(row.intent_id)
    && typeof row.planned_file_id === "string"
    && UUID_PATTERN.test(row.planned_file_id)
    && typeof row.submission_id === "string"
    && UUID_PATTERN.test(row.submission_id)
    && row.version_id === input.versionId
    && row.bucket_id === PROJECT_UPLOAD_BUCKET_ID
    && typeof row.object_path === "string"
    && row.object_path.startsWith(`${userId}/`)
    && row.original_filename === input.originalFilename
    && row.declared_mime === input.declaredMime
    && row.declared_size_bytes === input.declaredSizeBytes
    && (row.transfer_mode === "standard" || row.transfer_mode === "tus")
    && row.intent_state === "pending"
    && typeof row.expires_at === "string"
    && Number.isFinite(Date.parse(row.expires_at))
    && typeof row.reused === "boolean";
}

async function createIntent(
  client: SessionClient,
  input: ProjectUploadCapabilityInput,
  userId: string,
): Promise<UploadIntentRow | null> {
  const { data, error } = await client.rpc("create_project_upload_intent", {
    p_version_id: input.versionId,
    p_original_filename: input.originalFilename,
    p_declared_mime: input.declaredMime,
    p_declared_size_bytes: input.declaredSizeBytes,
  });

  const row = firstRpcRow(data);
  return error || !validIntentRow(row, input, userId) ? null : row;
}

async function cancelIntent(client: SessionClient, intentId: string): Promise<boolean> {
  const { error } = await client.rpc("cancel_project_upload_intent", {
    p_intent_id: intentId,
  });
  return !error;
}

function remainingIntentMilliseconds(intent: UploadIntentRow, now: number): number {
  return Date.parse(intent.expires_at) - now;
}

export async function requestProjectUploadCapabilityAction(
  inputValue: unknown,
): Promise<ProjectUploadCapabilityResult> {
  const sessionClient = await createServerSupabaseClient();
  const { data: claimsResult, error: claimsError } = await sessionClient.auth.getClaims();
  const userId = typeof claimsResult?.claims?.sub === "string"
    ? claimsResult.claims.sub
    : "";

  if (claimsError || !UUID_PATTERN.test(userId)) {
    return {
      status: "auth-required",
      message: "Войдите в аккаунт, чтобы подготовить загрузку проекта.",
    };
  }

  const input = normalizeInput(inputValue);
  if (!input) {
    return {
      status: "invalid",
      message: "Проверьте файл, его формат и размер.",
    };
  }

  try {
    let intent = await createIntent(sessionClient, input, userId);
    if (!intent) {
      return {
        status: "error",
        message: "Не удалось подготовить безопасный путь загрузки.",
      };
    }

    let now = Date.now();
    if (
      intent.reused
      && remainingIntentMilliseconds(intent, now)
        < PROJECT_UPLOAD_CAPABILITY_LIMITS.minimumFreshIntentMilliseconds
    ) {
      if (!await cancelIntent(sessionClient, intent.intent_id)) {
        return {
          status: "error",
          message: "Не удалось обновить срок загрузки. Попробуйте ещё раз.",
        };
      }

      intent = await createIntent(sessionClient, input, userId);
      now = Date.now();
    }

    if (
      !intent
      || remainingIntentMilliseconds(intent, now)
        < PROJECT_UPLOAD_CAPABILITY_LIMITS.minimumFreshIntentMilliseconds
    ) {
      return {
        status: "error",
        message: "Безопасная загрузка не успела получить полный срок действия.",
      };
    }

    const secretClient = createSecretSupabaseClient();
    const { data: signedData, error: signedError } = await secretClient.storage
      .from(PROJECT_UPLOAD_BUCKET_ID)
      .createSignedUploadUrl(intent.object_path, { upsert: false });

    if (
      signedError
      || !signedData
      || typeof signedData.token !== "string"
      || signedData.token.length < 20
      || signedData.path !== intent.object_path
    ) {
      return {
        status: "error",
        message: "Не удалось выпустить разрешение на загрузку.",
      };
    }

    const issuedAt = new Date().toISOString();
    return {
      status: "success",
      message: "Безопасное разрешение на загрузку подготовлено.",
      capability: {
        intentId: intent.intent_id,
        plannedFileId: intent.planned_file_id,
        versionId: intent.version_id,
        bucketId: PROJECT_UPLOAD_BUCKET_ID,
        objectPath: intent.object_path,
        originalFilename: intent.original_filename,
        declaredMime: intent.declared_mime as ProjectUploadMime,
        declaredSizeBytes: intent.declared_size_bytes,
        transferMode: intent.transfer_mode as ProjectUploadTransferMode,
        intentExpiresAt: intent.expires_at,
        capabilityExpiresAt: intent.expires_at,
        issuedAt,
        uploadToken: signedData.token,
        reusedIntent: intent.reused,
      },
    };
  } catch {
    return {
      status: "error",
      message: "Подготовка загрузки временно недоступна.",
    };
  }
}
