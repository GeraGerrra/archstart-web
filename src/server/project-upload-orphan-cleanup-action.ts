"use server";

import "server-only";

import { createSecretSupabaseClient } from "@/src/lib/supabase/admin";
import {
  PROJECT_FILE_FINALIZATION_LIMITS,
  type ProjectUploadOrphanCleanupResult,
} from "@/src/project-upload/finalization-types";
import {
  PROJECT_UUID_PATTERN,
  authenticatedProjectUserId,
  canonicalProjectObjectPath,
  plainRecord,
} from "./project-file-finalization-shared";

interface CleanupTarget {
  intentId: string;
  objectPath: string;
}

function cleanupTarget(value: unknown): CleanupTarget | null {
  const row = plainRecord(value);
  if (!row) return null;
  const intentId = row.intent_id;
  const userId = row.user_id;
  const submissionId = row.submission_id;
  const versionId = row.version_id;
  const plannedFileId = row.planned_file_id;
  const declaredMime = row.declared_mime;
  const objectPath = row.object_path;
  if (
    typeof intentId !== "string"
    || !PROJECT_UUID_PATTERN.test(intentId)
    || row.bucket_id !== "project-submissions"
    || typeof userId !== "string"
    || typeof submissionId !== "string"
    || typeof versionId !== "string"
    || typeof plannedFileId !== "string"
    || typeof declaredMime !== "string"
    || typeof objectPath !== "string"
    || canonicalProjectObjectPath({
      userId,
      submissionId,
      versionId,
      plannedFileId,
      declaredMime,
    }) !== objectPath
  ) return null;
  return { intentId, objectPath };
}

function result(
  status: ProjectUploadOrphanCleanupResult["status"],
  code: ProjectUploadOrphanCleanupResult["code"],
  examined = 0,
  removed = 0,
  closed = 0,
  failed = 0,
): ProjectUploadOrphanCleanupResult {
  return { status, code, examined, removed, closed, failed };
}

export async function cleanupStaleProjectUploadIntentsAction(): Promise<ProjectUploadOrphanCleanupResult> {
  const requesterId = await authenticatedProjectUserId();
  if (!requesterId) return result("auth-required", "auth-required");

  try {
    const secretClient = createSecretSupabaseClient();
    const { data, error } = await secretClient.rpc("list_stale_project_upload_intents", {
      p_requester_id: requesterId,
      p_limit: PROJECT_FILE_FINALIZATION_LIMITS.staleCleanupBatchSize,
    });
    if (error) return result("denied", "admin-required");
    if (!Array.isArray(data)) return result("error", "cleanup-unavailable");

    const targets = data.map(cleanupTarget);
    if (targets.some((target) => target === null)) {
      return result("error", "cleanup-unavailable", data.length, 0, 0, data.length);
    }

    let removed = 0;
    let closed = 0;
    let failed = 0;
    for (const target of targets as CleanupTarget[]) {
      const { error: removeError } = await secretClient.storage
        .from("project-submissions")
        .remove([target.objectPath]);
      if (removeError) {
        failed += 1;
        continue;
      }
      removed += 1;
      const { error: closeError } = await secretClient.rpc(
        "close_project_upload_intent_after_inspection",
        {
          p_intent_id: target.intentId,
          p_requester_id: requesterId,
          p_close_state: "expired",
          p_reason: "expired_stale_cleanup",
        },
      );
      if (closeError) failed += 1;
      else closed += 1;
    }

    return failed === 0
      ? result("success", "cleanup-complete", targets.length, removed, closed, failed)
      : result("partial", "cleanup-partial", targets.length, removed, closed, failed);
  } catch {
    return result("error", "cleanup-unavailable");
  }
}
