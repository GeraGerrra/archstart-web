export const PROJECT_UPLOAD_BUCKET_ID = "project-submissions" as const;

export const PROJECT_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/png",
] as const;

export const PROJECT_UPLOAD_CAPABILITY_LIMITS = Object.freeze({
  minimumBytes: 1,
  standardMaximumBytes: 6_291_456,
  absoluteMaximumBytes: 41_943_040,
  originalFilenameMaximumCharacters: 255,
  minimumFreshIntentMilliseconds: 115 * 60 * 1000,
});

export type ProjectUploadMime = (typeof PROJECT_UPLOAD_MIME_TYPES)[number];
export type ProjectUploadTransferMode = "standard" | "tus";

export interface ProjectUploadCapabilityInput {
  versionId: string;
  originalFilename: string;
  declaredMime: ProjectUploadMime;
  declaredSizeBytes: number;
}

export interface ProjectUploadCapability {
  intentId: string;
  plannedFileId: string;
  versionId: string;
  bucketId: typeof PROJECT_UPLOAD_BUCKET_ID;
  objectPath: string;
  originalFilename: string;
  declaredMime: ProjectUploadMime;
  declaredSizeBytes: number;
  transferMode: ProjectUploadTransferMode;
  intentExpiresAt: string;
  capabilityExpiresAt: string;
  issuedAt: string;
  uploadToken: string;
  reusedIntent: boolean;
}

export type ProjectUploadCapabilityResult =
  | {
      status: "success";
      message: string;
      capability: ProjectUploadCapability;
    }
  | {
      status: "auth-required" | "invalid" | "error";
      message: string;
    };
