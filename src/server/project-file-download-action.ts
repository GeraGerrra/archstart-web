"use server";

import "server-only";

import { createSecretSupabaseClient } from "@/src/lib/supabase/admin";
import {
  PROJECT_FILE_FINALIZATION_LIMITS,
  type ProjectFileDownloadResult,
} from "@/src/project-upload/finalization-types";
import {
  PROJECT_UUID_PATTERN,
  authenticatedProjectUserId,
  canonicalProjectObjectPath,
  exactUuidInput,
  oneRow,
  plainRecord,
} from "./project-file-finalization-shared";

export async function requestProjectFileDownloadAction(
  inputValue: unknown,
): Promise<ProjectFileDownloadResult> {
  const fileId = exactUuidInput(inputValue, "fileId");
  if (!fileId) {
    return { status: "invalid", message: "Передайте только корректный идентификатор файла." };
  }
  const requesterId = await authenticatedProjectUserId();
  if (!requesterId) {
    return { status: "auth-required", message: "Войдите в аккаунт, чтобы скачать файл." };
  }

  try {
    const secretClient = createSecretSupabaseClient();
    const { data, error } = await secretClient.rpc(
      "authorize_project_file_download",
      { p_file_id: fileId, p_requester_id: requesterId },
    );
    if (error) return { status: "error", message: "Скачивание временно недоступно." };
    const row = plainRecord(oneRow(data));
    if (!row) {
      return { status: "denied", message: "Файл недоступен." };
    }

    const userId = row.user_id;
    const submissionId = row.submission_id;
    const versionId = row.version_id;
    const plannedFileId = row.file_id;
    const declaredMime = row.declared_mime;
    const objectPath = row.object_path;
    if (
      row.bucket_id !== "project-submissions"
      || typeof userId !== "string"
      || typeof submissionId !== "string"
      || typeof versionId !== "string"
      || typeof plannedFileId !== "string"
      || !PROJECT_UUID_PATTERN.test(plannedFileId)
      || typeof objectPath !== "string"
      || typeof declaredMime !== "string"
      || canonicalProjectObjectPath({
        userId,
        submissionId,
        versionId,
        plannedFileId,
        declaredMime,
      }) !== objectPath
    ) {
      return { status: "error", message: "Скачивание временно недоступно." };
    }

    const { data: signed, error: signedError } = await secretClient.storage
      .from("project-submissions")
      .createSignedUrl(objectPath, PROJECT_FILE_FINALIZATION_LIMITS.signedDownloadSeconds);
    if (signedError || !signed || typeof signed.signedUrl !== "string") {
      return { status: "error", message: "Не удалось подготовить приватную ссылку." };
    }
    return {
      status: "success",
      signedUrl: signed.signedUrl,
      expiresAt: new Date(
        Date.now() + PROJECT_FILE_FINALIZATION_LIMITS.signedDownloadSeconds * 1_000,
      ).toISOString(),
      message: "Приватная ссылка подготовлена.",
    };
  } catch {
    return { status: "error", message: "Скачивание временно недоступно." };
  }
}
