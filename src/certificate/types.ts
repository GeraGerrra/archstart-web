export const CERTIFICATE_CODE_PATTERN = /^as-[0-9a-f]{32}$/u;

export type CertificateState =
  | "locked"
  | "eligible"
  | "issued"
  | "revoked"
  | "unavailable";

export interface CourseCertificateSnapshot {
  certificateId: string;
  certificateCode: string;
  displayName: string;
  courseTitle: string;
  courseVersion: string;
  issuedAt: string;
  revokedAt: string | null;
}

export interface MyCertificateProjection {
  state: CertificateState;
  completedLessons: number;
  requiredLessons: number;
  acceptedProjects: number;
  requiredProjects: number;
  profileNameReady: boolean;
  displayNamePreview: string | null;
  certificate: CourseCertificateSnapshot | null;
}

export type PublicCertificateStatus = "VALID" | "REVOKED";

export interface PublicCertificateVerification {
  found: boolean;
  certificateCode: string | null;
  displayName: string | null;
  courseTitle: string | null;
  courseVersion: string | null;
  issuedAt: string | null;
  status: PublicCertificateStatus | null;
}

export type CertificateIssueActionStatus =
  | "success"
  | "auth-required"
  | "onboarding-required"
  | "ineligible"
  | "revoked"
  | "error";

export interface CertificateIssueActionResult {
  status: CertificateIssueActionStatus;
  message: string;
  certificateCode?: string;
  reused?: boolean;
}
