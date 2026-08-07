"use client";

import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/src/auth/config";
import {
  PROJECT_STANDARD_TRANSFER_LIMITS,
  createProjectStandardTransferController,
  type ProjectStandardTransferController,
  type ProjectStandardTransferControllerOptions,
  type ProjectStandardUploadTransport,
} from "./standard-transfer.ts";
import { PROJECT_UPLOAD_BUCKET_ID } from "./types.ts";

function abortableFetch(signal: AbortSignal): typeof fetch {
  return async (input, init) => {
    if (signal.aborted) {
      throw new DOMException("Project upload aborted.", "AbortError");
    }
    return fetch(input, {
      ...init,
      signal,
    });
  };
}

export function createSupabaseStandardUploadTransport(): ProjectStandardUploadTransport {
  return {
    async upload({ capability, file, signal }) {
      const config = getPublicSupabaseConfig();
      const client = createClient(config.url, config.publishableKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: abortableFetch(signal),
        },
      });

      const { data, error } = await client.storage
        .from(PROJECT_UPLOAD_BUCKET_ID)
        .uploadToSignedUrl(
          capability.objectPath,
          capability.uploadToken,
          file,
          {
            cacheControl: String(PROJECT_STANDARD_TRANSFER_LIMITS.cacheControlSeconds),
            contentType: capability.declaredMime,
            upsert: false,
          },
        );

      if (error) throw error;

      const expectedFullPath = `${PROJECT_UPLOAD_BUCKET_ID}/${capability.objectPath}`;
      if (
        !data
        || data.path !== capability.objectPath
        || data.fullPath !== expectedFullPath
      ) {
        throw new Error("Storage returned an unexpected upload path.");
      }

      return {
        path: data.path,
        fullPath: data.fullPath,
      };
    },
  };
}

export function createSupabaseProjectStandardTransferController(
  options?: ProjectStandardTransferControllerOptions,
): ProjectStandardTransferController {
  return createProjectStandardTransferController(
    createSupabaseStandardUploadTransport(),
    options,
  );
}
