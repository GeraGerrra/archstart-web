"use client";

import * as tus from "tus-js-client";
import { getPublicSupabaseConfig } from "@/src/auth/config";
import {
  PROJECT_TUS_TRANSFER_LIMITS,
  createProjectTusTransferController,
  isSafeProjectTusUploadUrl,
  shouldRetryProjectTusRequest,
  type ProjectTusPreviousUpload,
  type ProjectTusTransferController,
  type ProjectTusTransferControllerOptions,
  type ProjectTusUploadSession,
  type ProjectTusUploadTransport,
} from "./tus-transfer.ts";
import {
  PROJECT_UPLOAD_BUCKET_ID,
  type ProjectUploadCapability,
} from "./types.ts";

const STANDARD_SUPABASE_HOST_PATTERN = /^([a-z0-9]{20})\.supabase\.co$/u;

function deriveDirectTusEndpoint(supabaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }

  const match = STANDARD_SUPABASE_HOST_PATTERN.exec(parsed.hostname);
  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.port
    || parsed.pathname !== "/"
    || parsed.search
    || parsed.hash
    || !match?.[1]
  ) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use the standard HTTPS project hostname.");
  }

  return `https://${match[1]}.storage.supabase.co/storage/v1/upload/resumable`;
}

function fingerprintFor(
  file: File,
  capability: ProjectUploadCapability,
): string {
  return [
    "archstart-project-tus-v1",
    PROJECT_UPLOAD_BUCKET_ID,
    capability.objectPath,
    capability.intentId,
    capability.plannedFileId,
    file.name,
    file.type,
    String(file.size),
    String(file.lastModified),
  ].join(":");
}

function unsafeUploadUrlError(): Error {
  return new Error("Unsafe TUS upload URL returned by Storage.");
}

export function createSupabaseTusUploadTransport(): ProjectTusUploadTransport {
  const config = getPublicSupabaseConfig();
  const endpoint = deriveDirectTusEndpoint(config.url);

  return {
    endpoint,
    supported: tus.isSupported,
    canStorePreviousUploads: tus.canStoreURLs,

    createSession({
      capability,
      file,
      onProgress,
      onSuccess,
      onError,
      onUploadUrlAvailable,
    }): ProjectTusUploadSession {
      let terminalCallbackSent = false;
      let unsafeTerminationStarted = false;

      function emitError(error: unknown): void {
        if (terminalCallbackSent) return;
        terminalCallbackSent = true;
        onError(error);
      }

      function verifiedUploadUrl(): string | null {
        const uploadUrl = upload.url;
        return uploadUrl && isSafeProjectTusUploadUrl(uploadUrl, endpoint)
          ? uploadUrl
          : null;
      }

      function rejectUnsafeUploadUrl(): void {
        if (terminalCallbackSent || unsafeTerminationStarted) return;
        unsafeTerminationStarted = true;
        void upload.abort(true)
          .catch(() => undefined)
          .finally(() => emitError(unsafeUploadUrlError()));
      }

      const upload = new tus.Upload(file, {
        endpoint,
        headers: {
          "x-signature": capability.uploadToken,
          "x-upsert": "false",
        },
        metadata: {
          bucketName: PROJECT_UPLOAD_BUCKET_ID,
          objectName: capability.objectPath,
          contentType: capability.declaredMime,
          cacheControl: String(PROJECT_TUS_TRANSFER_LIMITS.cacheControlSeconds),
        },
        chunkSize: PROJECT_TUS_TRANSFER_LIMITS.chunkSizeBytes,
        parallelUploads: 1,
        retryDelays: [...PROJECT_TUS_TRANSFER_LIMITS.requestRetryDelaysMilliseconds],
        onShouldRetry: (error) => shouldRetryProjectTusRequest(error),
        uploadDataDuringCreation: true,
        storeFingerprintForResuming: true,
        removeFingerprintOnSuccess: true,
        fingerprint: () => Promise.resolve(fingerprintFor(file, capability)),
        onProgress,
        onUploadUrlAvailable: () => {
          const uploadUrl = verifiedUploadUrl();
          if (!uploadUrl) {
            rejectUnsafeUploadUrl();
            return;
          }
          onUploadUrlAvailable(uploadUrl);
        },
        onSuccess: () => {
          if (terminalCallbackSent) return;
          const uploadUrl = verifiedUploadUrl();
          if (!uploadUrl) {
            rejectUnsafeUploadUrl();
            return;
          }
          terminalCallbackSent = true;
          onSuccess({ uploadUrl });
        },
        onError: emitError,
      });

      return {
        findPreviousUploads: () => upload.findPreviousUploads(),
        resumeFromPreviousUpload(previousUpload: ProjectTusPreviousUpload) {
          upload.resumeFromPreviousUpload(previousUpload);
        },
        start() {
          upload.start();
        },
        pause() {
          return upload.abort(false);
        },
        cancel() {
          return upload.abort(true);
        },
        getUploadUrl() {
          return upload.url;
        },
      };
    },
  };
}

export function createSupabaseProjectTusTransferController(
  options?: ProjectTusTransferControllerOptions,
): ProjectTusTransferController {
  return createProjectTusTransferController(
    createSupabaseTusUploadTransport(),
    options,
  );
}
