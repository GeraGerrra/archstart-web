import {
  CERTIFICATE_CODE_PATTERN,
  type CourseCertificateSnapshot,
  type MyCertificateProjection,
  type PublicCertificateStatus,
  type PublicCertificateVerification,
} from "./types";

const CERTIFICATE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const COURSE_CODE = "ARCHSTART_CORE";
const COURSE_VERSION = "2026.08";
const COURSE_TITLE = "ARCH.START — русскоязычный вводный курс архитектуры";
const REQUIRED_LESSONS = 40;
const REQUIRED_PROJECTS = 8;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return record(value[0]);
  return record(value);
}

function boundedInteger(value: unknown, maximum: number): number | null {
  return Number.isInteger(value) && typeof value === "number" && value >= 0 && value <= maximum
    ? value
    : null;
}

function nonEmptyText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/gu, " ");
  return normalized.length > 0 && normalized.length <= maximum ? normalized : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function nullableIsoTimestamp(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return isoTimestamp(value) ?? undefined;
}

export function normalizeCertificateCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return CERTIFICATE_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function publicCertificatePath(certificateCode: string): string {
  const normalized = normalizeCertificateCode(certificateCode);
  return normalized ? `/certificate/${normalized}` : "/certificate/not-found";
}

export interface ParsedCertificateEligibility {
  state: "locked" | "eligible" | "issued" | "revoked";
  completedLessons: number;
  requiredLessons: number;
  acceptedProjects: number;
  requiredProjects: number;
  profileNameReady: boolean;
  displayNamePreview: string | null;
  certificateReference: {
    certificateId: string;
    certificateCode: string;
    issuedAt: string;
    revokedAt: string | null;
  } | null;
}

export function unavailableCertificateProjection(): MyCertificateProjection {
  return {
    state: "unavailable",
    completedLessons: 0,
    requiredLessons: REQUIRED_LESSONS,
    acceptedProjects: 0,
    requiredProjects: REQUIRED_PROJECTS,
    profileNameReady: false,
    displayNamePreview: null,
    certificate: null,
  };
}

export function parseMyCertificateEligibility(value: unknown): ParsedCertificateEligibility | null {
  const row = firstRow(value);
  if (!row) return null;

  const state = row.certificate_state;
  if (state !== "locked" && state !== "eligible" && state !== "issued" && state !== "revoked") {
    return null;
  }

  const completedLessons = boundedInteger(row.completed_lessons, REQUIRED_LESSONS);
  const requiredLessons = boundedInteger(row.required_lessons, REQUIRED_LESSONS);
  const acceptedProjects = boundedInteger(row.accepted_projects, REQUIRED_PROJECTS);
  const requiredProjects = boundedInteger(row.required_projects, REQUIRED_PROJECTS);
  const profileNameReady = typeof row.profile_name_ready === "boolean"
    ? row.profile_name_ready
    : null;
  const displayNamePreview = row.display_name_preview === null
    ? null
    : nonEmptyText(row.display_name_preview, 161);

  if (
    completedLessons === null
    || requiredLessons !== REQUIRED_LESSONS
    || acceptedProjects === null
    || requiredProjects !== REQUIRED_PROJECTS
    || profileNameReady === null
    || (profileNameReady && !displayNamePreview)
  ) {
    return null;
  }

  let certificateReference: ParsedCertificateEligibility["certificateReference"] = null;
  if (state === "issued" || state === "revoked") {
    const certificateId = typeof row.certificate_id === "string"
      && CERTIFICATE_ID_PATTERN.test(row.certificate_id)
      ? row.certificate_id
      : null;
    const certificateCode = normalizeCertificateCode(row.certificate_code);
    const issuedAt = isoTimestamp(row.issued_at);
    const revokedAt = nullableIsoTimestamp(row.revoked_at);
    if (!certificateId || !certificateCode || !issuedAt || revokedAt === undefined) return null;
    if (state === "issued" && revokedAt !== null) return null;
    if (state === "revoked" && revokedAt === null) return null;
    certificateReference = { certificateId, certificateCode, issuedAt, revokedAt };
  } else if (
    row.certificate_id !== null
    || row.certificate_code !== null
    || row.issued_at !== null
    || row.revoked_at !== null
  ) {
    return null;
  }

  if (state === "eligible" && (
    completedLessons !== REQUIRED_LESSONS
    || acceptedProjects !== REQUIRED_PROJECTS
    || !profileNameReady
  )) return null;

  return {
    state,
    completedLessons,
    requiredLessons,
    acceptedProjects,
    requiredProjects,
    profileNameReady,
    displayNamePreview,
    certificateReference,
  };
}

export function parseOwnCertificateSnapshot(
  value: unknown,
  eligibility: ParsedCertificateEligibility,
): CourseCertificateSnapshot | null {
  if (!eligibility.certificateReference) return null;
  const row = firstRow(value);
  if (!row) return null;

  const certificateId = typeof row.id === "string" && CERTIFICATE_ID_PATTERN.test(row.id)
    ? row.id
    : null;
  const certificateCode = normalizeCertificateCode(row.certificate_code);
  const displayName = nonEmptyText(row.display_name_snapshot, 161);
  const courseCode = nonEmptyText(row.course_code, 32);
  const courseTitle = nonEmptyText(row.course_title_snapshot, 240);
  const courseVersion = nonEmptyText(row.course_version, 32);
  const issuedAt = isoTimestamp(row.issued_at);
  const revokedAt = nullableIsoTimestamp(row.revoked_at);

  if (
    certificateId !== eligibility.certificateReference.certificateId
    || certificateCode !== eligibility.certificateReference.certificateCode
    || !displayName
    || courseCode !== COURSE_CODE
    || courseTitle !== COURSE_TITLE
    || courseVersion !== COURSE_VERSION
    || issuedAt !== eligibility.certificateReference.issuedAt
    || revokedAt === undefined
    || revokedAt !== eligibility.certificateReference.revokedAt
  ) return null;

  return {
    certificateId,
    certificateCode,
    displayName,
    courseTitle,
    courseVersion,
    issuedAt,
    revokedAt,
  };
}

export function composeMyCertificateProjection(
  eligibility: ParsedCertificateEligibility,
  certificate: CourseCertificateSnapshot | null,
): MyCertificateProjection | null {
  if ((eligibility.state === "issued" || eligibility.state === "revoked") && !certificate) {
    return null;
  }
  if ((eligibility.state === "locked" || eligibility.state === "eligible") && certificate) {
    return null;
  }
  return {
    state: eligibility.state,
    completedLessons: eligibility.completedLessons,
    requiredLessons: eligibility.requiredLessons,
    acceptedProjects: eligibility.acceptedProjects,
    requiredProjects: eligibility.requiredProjects,
    profileNameReady: eligibility.profileNameReady,
    displayNamePreview: eligibility.displayNamePreview,
    certificate,
  };
}

export function parseIssuedCertificate(value: unknown): {
  certificate: CourseCertificateSnapshot;
  reused: boolean;
} | null {
  const row = firstRow(value);
  if (!row) return null;

  const certificateId = typeof row.certificate_id === "string"
    && CERTIFICATE_ID_PATTERN.test(row.certificate_id)
    ? row.certificate_id
    : null;
  const certificateCode = normalizeCertificateCode(row.certificate_code);
  const displayName = nonEmptyText(row.display_name_snapshot, 161);
  const courseTitle = nonEmptyText(row.course_title_snapshot, 240);
  const courseVersion = nonEmptyText(row.course_version, 32);
  const issuedAt = isoTimestamp(row.issued_at);
  const reused = typeof row.reused === "boolean" ? row.reused : null;

  if (
    !certificateId
    || !certificateCode
    || !displayName
    || courseTitle !== COURSE_TITLE
    || courseVersion !== COURSE_VERSION
    || !issuedAt
    || reused === null
  ) return null;

  return {
    certificate: {
      certificateId,
      certificateCode,
      displayName,
      courseTitle,
      courseVersion,
      issuedAt,
      revokedAt: null,
    },
    reused,
  };
}

export function emptyPublicCertificateVerification(): PublicCertificateVerification {
  return {
    found: false,
    certificateCode: null,
    displayName: null,
    courseTitle: null,
    courseVersion: null,
    issuedAt: null,
    status: null,
  };
}

export function parsePublicCertificateVerification(
  value: unknown,
): PublicCertificateVerification | null {
  const row = firstRow(value);
  if (!row) return emptyPublicCertificateVerification();

  const certificateCode = normalizeCertificateCode(row.certificate_code);
  const displayName = nonEmptyText(row.display_name_snapshot, 161);
  const courseTitle = nonEmptyText(row.course_title_snapshot, 240);
  const courseVersion = nonEmptyText(row.course_version, 32);
  const issuedAt = isoTimestamp(row.issued_at);
  const status = row.certificate_status === "VALID" || row.certificate_status === "REVOKED"
    ? row.certificate_status as PublicCertificateStatus
    : null;

  if (
    !certificateCode
    || !displayName
    || courseTitle !== COURSE_TITLE
    || courseVersion !== COURSE_VERSION
    || !issuedAt
    || !status
  ) return null;

  return {
    found: true,
    certificateCode,
    displayName,
    courseTitle,
    courseVersion,
    issuedAt,
    status,
  };
}

export function formatCertificateDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export const CERTIFICATE_MVP_IDENTITY = {
  courseCode: COURSE_CODE,
  courseVersion: COURSE_VERSION,
  courseTitle: COURSE_TITLE,
  requiredLessons: REQUIRED_LESSONS,
  requiredProjects: REQUIRED_PROJECTS,
} as const;
