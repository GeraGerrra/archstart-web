import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const PROJECT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function plainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function exactUuidInput(value: unknown, key: string): string | null {
  const record = plainRecord(value);
  if (!record || Object.keys(record).length !== 1) return null;
  const candidate = record[key];
  return typeof candidate === "string" && PROJECT_UUID_PATTERN.test(candidate.trim())
    ? candidate.trim().toLowerCase()
    : null;
}

export function oneRow(value: unknown): unknown {
  if (Array.isArray(value)) return value.length === 1 ? value[0] : null;
  return value;
}

export async function authenticatedProjectUserId(): Promise<string | null> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
  return !error && PROJECT_UUID_PATTERN.test(userId) ? userId.toLowerCase() : null;
}

export function canonicalProjectObjectPath(input: {
  userId: string;
  submissionId: string;
  versionId: string;
  plannedFileId: string;
  declaredMime: string;
}): string | null {
  for (const value of [
    input.userId,
    input.submissionId,
    input.versionId,
    input.plannedFileId,
  ]) {
    if (!PROJECT_UUID_PATTERN.test(value)) return null;
  }
  const extension = input.declaredMime === "application/pdf"
    ? "pdf"
    : input.declaredMime === "image/png"
      ? "png"
      : null;
  if (!extension) return null;
  return `${input.userId}/${input.submissionId}/${input.versionId}/${input.plannedFileId}.${extension}`;
}

export function storageErrorIsMissing(error: unknown): boolean {
  const record = plainRecord(error);
  if (!record) return false;
  const status = record.status ?? record.statusCode;
  return status === 404 || status === "404";
}
