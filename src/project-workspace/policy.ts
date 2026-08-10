import {
  PROJECT_CODES,
  PROJECT_SUBMISSION_STATUSES,
  type ProjectCode,
  type ProjectSubmissionStatus,
} from "./types.ts";

export const PROJECT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const PROJECT_FILE_LIMITS = Object.freeze({
  standardMaximumBytes: 6_291_456,
  absoluteMaximumBytes: 41_943_040,
  noteMaximumCharacters: 2_000,
  supportingTextMaximumCharacters: 8_000,
});

export function isProjectCode(value: unknown): value is ProjectCode {
  return typeof value === "string"
    && PROJECT_CODES.includes(value.toUpperCase() as ProjectCode);
}

export function normalizeProjectCode(value: unknown): ProjectCode | null {
  return isProjectCode(value) ? value.toUpperCase() as ProjectCode : null;
}

export function isProjectSubmissionStatus(
  value: unknown,
): value is ProjectSubmissionStatus {
  return typeof value === "string"
    && PROJECT_SUBMISSION_STATUSES.includes(value as ProjectSubmissionStatus);
}

export function moduleCodeForProject(projectCode: ProjectCode): string {
  return projectCode.slice(0, 3);
}

export function projectCodeForModule(moduleCode: string): ProjectCode | null {
  const normalized = moduleCode.trim().toUpperCase();
  const match = /^M0([1-8])$/u.exec(normalized);
  return match?.[1] ? `${normalized}_P0${match[1]}` as ProjectCode : null;
}

export function projectSupportingTextWordCount(value: string): number {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

export function exactObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) return null;
  return record;
}
