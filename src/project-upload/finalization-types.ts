export const PROJECT_FILE_FINALIZATION_LIMITS = Object.freeze({
  minimumBytes: 1,
  maximumBytes: 41_943_040,
  expectedPngWidth: 1_920,
  expectedPngHeight: 1_080,
  signedDownloadSeconds: 60,
  staleCleanupBatchSize: 20,
});

export const PROJECT_FILE_REJECTION_REASONS = [
  "object_missing",
  "object_size_out_of_bounds",
  "declared_size_mismatch",
  "unsupported_actual_mime",
  "declared_mime_mismatch",
  "malformed_png",
  "invalid_png_dimensions",
  "malformed_pdf",
  "encrypted_or_unsupported_pdf",
  "invalid_pdf_page_count",
  "frozen_policy_mismatch",
  "expired_before_finalization",
  "inconsistent_finalization_context",
  "expired_stale_cleanup",
] as const;

export type ProjectFileRejectionReason =
  (typeof PROJECT_FILE_REJECTION_REASONS)[number];

export type ProjectFileDetectedMime = "application/pdf" | "image/png";

export type ProjectFileInspection =
  | {
      ok: true;
      detectedMime: ProjectFileDetectedMime;
      sizeBytes: number;
      sha256: string;
      pageCount: number | null;
      pixelWidth: number | null;
      pixelHeight: number | null;
    }
  | {
      ok: false;
      reason: Extract<
        ProjectFileRejectionReason,
        | "object_size_out_of_bounds"
        | "unsupported_actual_mime"
        | "malformed_png"
        | "malformed_pdf"
        | "encrypted_or_unsupported_pdf"
      >;
    };

export interface ProjectFilePolicySnapshot {
  declaredMime: ProjectFileDetectedMime;
  declaredSizeBytes: number;
  formatType: "SINGLE_BOARD" | "MULTI_PAGE_PACK";
  allowedMimeTypes: readonly ProjectFileDetectedMime[];
  maxFileBytes: number;
  expectedWidth: number;
  expectedHeight: number;
  minPageCount: number;
  maxPageCount: number;
}

export type ProjectFilePolicyValidation =
  | { ok: true }
  | {
      ok: false;
      reason: Extract<
        ProjectFileRejectionReason,
        | "declared_size_mismatch"
        | "declared_mime_mismatch"
        | "invalid_png_dimensions"
        | "invalid_pdf_page_count"
        | "frozen_policy_mismatch"
      >;
    };

export type ProjectFileFinalizationResult =
  | {
      status: "success";
      fileId: string;
      reused: boolean;
      message: string;
    }
  | {
      status:
        | "auth-required"
        | "invalid"
        | "denied"
        | "rejected"
        | "cleanup-failed"
        | "error";
      reason?: ProjectFileRejectionReason;
      message: string;
    };

export type ProjectFileDownloadResult =
  | {
      status: "success";
      signedUrl: string;
      expiresAt: string;
      message: string;
    }
  | {
      status: "auth-required" | "invalid" | "denied" | "error";
      message: string;
    };

export interface ProjectUploadOrphanCleanupResult {
  status: "success" | "auth-required" | "denied" | "partial" | "error";
  examined: number;
  removed: number;
  closed: number;
  failed: number;
  code:
    | "cleanup-complete"
    | "auth-required"
    | "admin-required"
    | "cleanup-partial"
    | "cleanup-unavailable";
}
