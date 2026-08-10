import type {
  ProjectStandardTransferSnapshot,
  ProjectTusTransferSnapshot,
} from "@/src/project-upload";
import type { ProjectFileFinalizationResult } from "@/src/project-upload/finalization-types";

export const UNEXPECTED_WORKSPACE_ERROR_MESSAGE =
  "Действие временно недоступно. Попробуйте ещё раз.";

export const FINALIZATION_RETRY_MESSAGE =
  "Файл передан, но проверка временно не завершилась. Повторите проверку файла.";

export function isTusSessionOpen(
  snapshot: ProjectTusTransferSnapshot | null,
): boolean {
  return snapshot?.status === "validating"
    || snapshot?.status === "uploading"
    || snapshot?.status === "paused";
}

export function isReusableIntentConflict(
  snapshot: ProjectStandardTransferSnapshot | ProjectTusTransferSnapshot,
  reusedIntent: boolean,
): boolean {
  return reusedIntent
    && snapshot.status === "failed"
    && snapshot.errorCode === "conflict";
}

export function finalizationKeepsRetry(
  result: ProjectFileFinalizationResult,
): boolean {
  return result.status !== "success"
    && result.status !== "rejected"
    && result.status !== "denied";
}

export function parseCriterionPoints(
  value: string,
  maximum: number,
): number | null {
  if (!value.trim()) return null;
  const points = Number(value);
  return Number.isSafeInteger(points) && points >= 0 && points <= maximum
    ? points
    : null;
}
