import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createProjectStandardTransferController,
  validateProjectStandardTransferInput,
  type ProjectStandardUploadTransport,
} from "../src/project-upload/standard-transfer.ts";
import type { ProjectUploadCapability } from "../src/project-upload/types.ts";

const documentationPath = "PHASE07_PROJECT_STANDARD_SIGNED_TRANSFER.md";
const contractPath = "PHASE07_PROJECT_STANDARD_SIGNED_TRANSFER_V1.json";
const controllerPath = "src/project-upload/standard-transfer.ts";
const adapterPath = "src/project-upload/supabase-standard-transfer.ts";
const barrelPath = "src/project-upload/index.ts";
const readinessPath =
  "supabase/verification/phase07-pass2c2b2a-project-standard-signed-transfer-readiness.sql";

const fixedNow = Date.parse("2026-08-07T00:00:00.000Z");

async function text(path: string): Promise<string> {
  return readFile(path, "utf8");
}

function executable(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\/\/.*$/gmu, "");
}

function file(overrides: Partial<File> = {}): File {
  return {
    name: "board.png",
    type: "image/png",
    size: 1_048_576,
    ...overrides,
  } as File;
}

function capability(overrides: Partial<ProjectUploadCapability> = {}): ProjectUploadCapability {
  const versionId = "33333333-3333-4333-8333-333333333333";
  const plannedFileId = "44444444-4444-4444-8444-444444444444";
  return {
    intentId: "55555555-5555-4555-8555-555555555555",
    plannedFileId,
    versionId,
    bucketId: "project-submissions",
    objectPath:
      `11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/${versionId}/${plannedFileId}.png`,
    originalFilename: "board.png",
    declaredMime: "image/png",
    declaredSizeBytes: 1_048_576,
    transferMode: "standard",
    intentExpiresAt: new Date(fixedNow + 7_200_000).toISOString(),
    capabilityExpiresAt: new Date(fixedNow + 7_200_000).toISOString(),
    issuedAt: new Date(fixedNow).toISOString(),
    uploadToken: "signed-upload-token-with-more-than-twenty-characters",
    reusedIntent: false,
    ...overrides,
  };
}

function transportResult(path: string) {
  return { path, fullPath: `project-submissions/${path}` };
}

test("Pass 2C2B2A is pinned to the accepted B1 source and readiness evidence", async () => {
  const contract = JSON.parse(await text(contractPath)) as {
    acceptedSource: {
      gitHead: string;
      sourceContextZipSha256: string;
      hostedReadiness: {
        result: string;
        uploadIntentRows: number;
        projectObjects: number;
        projectObjectPolicies: number;
      };
    };
    sourceBoundary: {
      pathCount: number;
      changedPaths: string[];
      dependencyChange: boolean;
      databaseMigration: boolean;
      liveStorageObjectWrite: boolean;
    };
  };

  assert.equal(contract.acceptedSource.gitHead, "383d18f9e4fc46503071fbe008369d40277833df");
  assert.equal(
    contract.acceptedSource.sourceContextZipSha256,
    "490384e8fa570dd6a0f7685ea4b945141b8d827d0d26a21792deaff780454255",
  );
  assert.equal(contract.acceptedSource.hostedReadiness.result, "PASS");
  assert.equal(contract.acceptedSource.hostedReadiness.uploadIntentRows, 0);
  assert.equal(contract.acceptedSource.hostedReadiness.projectObjects, 0);
  assert.equal(contract.acceptedSource.hostedReadiness.projectObjectPolicies, 0);
  assert.equal(contract.sourceBoundary.pathCount, 7);
  assert.equal(contract.sourceBoundary.changedPaths.length, 7);
  assert.equal(contract.sourceBoundary.dependencyChange, false);
  assert.equal(contract.sourceBoundary.databaseMigration, false);
  assert.equal(contract.sourceBoundary.liveStorageObjectWrite, false);
});

test("exact file and capability validation precedes every network call", () => {
  const accepted = validateProjectStandardTransferInput(file(), capability(), fixedNow);
  assert.deepEqual(accepted, { ok: true });

  assert.deepEqual(
    validateProjectStandardTransferInput(file({ size: 1_048_575 }), capability(), fixedNow),
    {
      ok: false,
      code: "invalid-file",
      message: "Выбранный файл не совпадает с подготовленным разрешением.",
    },
  );
  assert.equal(
    validateProjectStandardTransferInput(
      file(),
      capability({ transferMode: "tus" }),
      fixedNow,
    ).ok,
    false,
  );
  assert.equal(
    validateProjectStandardTransferInput(
      file(),
      capability({ objectPath: "../board.png" }),
      fixedNow,
    ).ok,
    false,
  );
  assert.equal(
    validateProjectStandardTransferInput(
      file(),
      capability({ capabilityExpiresAt: new Date(fixedNow + 1_000).toISOString() }),
      fixedNow,
    ).ok,
    false,
  );
});

test("standard transfer exposes truthful indeterminate progress and completes only on exact path", async () => {
  let resolveUpload: (value: { path: string; fullPath: string }) => void = () => undefined;
  const uploadPromise = new Promise<{ path: string; fullPath: string }>((resolve) => {
    resolveUpload = resolve;
  });
  const transport: ProjectStandardUploadTransport = {
    upload: () => uploadPromise,
  };
  const controller = createProjectStandardTransferController(transport, {
    now: () => fixedNow,
  });
  const expected = capability();
  const started = controller.start(file(), expected);

  assert.deepEqual(controller.getSnapshot().progress, {
    kind: "indeterminate",
    loadedBytes: null,
    totalBytes: 1_048_576,
    percentage: null,
  });
  assert.equal(controller.getSnapshot().status, "uploading");

  resolveUpload(transportResult(expected.objectPath) as { path: string; fullPath: string });
  const completed = await started;
  assert.equal(completed.status, "succeeded");
  assert.deepEqual(completed.progress, {
    kind: "complete",
    loadedBytes: 1_048_576,
    totalBytes: 1_048_576,
    percentage: 100,
  });
});

test("controller cancellation aborts the real transport signal and remains terminal", async () => {
  const observedSignals: AbortSignal[] = [];
  const transport: ProjectStandardUploadTransport = {
    upload: ({ signal }) => new Promise((resolve, reject) => {
      observedSignals.push(signal);
      signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
      void resolve;
    }),
  };
  const controller = createProjectStandardTransferController(transport, {
    now: () => fixedNow,
  });
  const started = controller.start(file(), capability());
  assert.equal(controller.cancel(), true);
  const cancelled = await started;

  assert.equal(observedSignals[0]?.aborted, true);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.canRetry, false);
  assert.equal((await controller.retry()).status, "cancelled");
});

test("one bounded retry is allowed only for retryable failures", async () => {
  let calls = 0;
  const expected = capability();
  const transport: ProjectStandardUploadTransport = {
    async upload() {
      calls += 1;
      if (calls === 1) throw { statusCode: 503, message: "temporary" };
      return transportResult(expected.objectPath);
    },
  };
  const controller = createProjectStandardTransferController(transport, {
    now: () => fixedNow,
  });

  const first = await controller.start(file(), expected);
  assert.equal(first.status, "failed");
  assert.equal(first.errorCode, "server-error");
  assert.equal(first.attempt, 1);
  assert.equal(first.canRetry, true);

  const second = await controller.retry();
  assert.equal(second.status, "succeeded");
  assert.equal(second.attempt, 2);
  assert.equal(second.canRetry, false);
  assert.equal(calls, 2);
});

test("400, 401, 403, 409 and 413 are terminal and distinctly classified", async () => {
  const cases = [
    [400, "bad-request"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [409, "conflict"],
    [413, "too-large"],
  ] as const;

  for (const [statusCode, expectedCode] of cases) {
    const controller = createProjectStandardTransferController({
      async upload() {
        throw { statusCode, message: `status ${statusCode}` };
      },
    }, { now: () => fixedNow });
    const result = await controller.start(file(), capability());
    assert.equal(result.status, "failed");
    assert.equal(result.errorCode, expectedCode);
    assert.equal(result.canRetry, false);
  }
});

test("a 400 Asset Already Exists response is normalized as a path conflict", async () => {
  const controller = createProjectStandardTransferController({
    async upload() {
      throw { statusCode: 400, message: "Asset Already Exists" };
    },
  }, { now: () => fixedNow });
  const result = await controller.start(file(), capability());
  assert.equal(result.errorCode, "conflict");
  assert.equal(result.canRetry, false);
});

test("a capability can enter public start only once per controller instance", async () => {
  const expected = capability();
  const controller = createProjectStandardTransferController({
    async upload() {
      return transportResult(expected.objectPath);
    },
  }, { now: () => fixedNow });

  assert.equal((await controller.start(file(), expected)).status, "succeeded");
  assert.equal(controller.reset(), true);
  const reused = await controller.start(file(), expected);
  assert.equal(reused.status, "failed");
  assert.equal(reused.errorCode, "capability-reused");
});


test("concurrent start calls share one active operation and observers cannot break it", async () => {
  let calls = 0;
  let resolveUpload: (value: { path: string; fullPath: string }) => void = () => undefined;
  const pending = new Promise<{ path: string; fullPath: string }>((resolve) => {
    resolveUpload = resolve;
  });
  const expected = capability();
  const controller = createProjectStandardTransferController({
    upload() {
      calls += 1;
      return pending;
    },
  }, { now: () => fixedNow });
  controller.subscribe(() => {
    throw new Error("observer failure must be isolated");
  });

  const first = controller.start(file(), expected);
  const second = controller.start(file(), expected);
  assert.equal(calls, 1);
  resolveUpload(transportResult(expected.objectPath) as { path: string; fullPath: string });
  assert.equal((await first).status, "succeeded");
  assert.equal((await second).status, "succeeded");
  assert.equal(calls, 1);
});

test("HTTP 408 is a distinct retryable timeout and 429 remains rate limited", async () => {
  for (const [statusCode, expectedCode] of [[408, "timeout"], [429, "rate-limited"]] as const) {
    const controller = createProjectStandardTransferController({
      async upload() {
        throw { statusCode, message: `status ${statusCode}` };
      },
    }, { now: () => fixedNow });
    const result = await controller.start(file(), capability());
    assert.equal(result.status, "failed");
    assert.equal(result.errorCode, expectedCode);
    assert.equal(result.canRetry, true);
  }
});

test("unexpected adapter path errors are terminal invalid Storage responses", async () => {
  const controller = createProjectStandardTransferController({
    async upload() {
      throw new Error("Storage returned an unexpected upload path.");
    },
  }, { now: () => fixedNow });
  const result = await controller.start(file(), capability());
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "invalid-storage-response");
  assert.equal(result.canRetry, false);
});

test("the production attempt ceiling is fixed at exactly two", async () => {
  const source = executable(await text(controllerPath));
  assert.match(source, /maximumAttemptsPerCapability:\s*2/u);
  assert.doesNotMatch(source, /maximumAttemptsPerCapability\?:/u);
  assert.doesNotMatch(source, /maximumAttempts\s*>\s*2/u);
});

test("Supabase adapter performs one abortable non-upsert uploadToSignedUrl call", async () => {
  const source = executable(await text(adapterPath));
  assert.match(source, /^"use client";/u);
  assert.match(source, /createClient/u);
  assert.match(source, /global:\s*\{\s*fetch: abortableFetch\(signal\)/u);
  assert.match(source, /return fetch\(input, \{[\s\S]*signal,[\s\S]*\}\);/u);
  assert.match(source, /\.from\(PROJECT_UPLOAD_BUCKET_ID\)/u);
  assert.match(source, /\.uploadToSignedUrl\(/u);
  assert.match(source, /capability\.objectPath/u);
  assert.match(source, /capability\.uploadToken/u);
  assert.match(source, /expectedFullPath/u);
  assert.match(source, /data\.fullPath !== expectedFullPath/u);
  assert.match(source, /cacheControl:/u);
  assert.match(source, /contentType: capability\.declaredMime/u);
  assert.match(source, /upsert: false/u);
  assert.doesNotMatch(source, /createSecretSupabaseClient|SUPABASE_SECRET_KEY|console\./u);
  assert.doesNotMatch(source, /\.upload\(|\.remove\(|\.update\(/u);
});

test("client-safe barrel exposes the pure controller but not the Supabase client adapter", async () => {
  const source = executable(await text(barrelPath));
  assert.match(source, /createProjectStandardTransferController/u);
  assert.match(source, /ProjectStandardTransferSnapshot/u);
  assert.doesNotMatch(source, /supabase-standard-transfer|createSupabaseStandardUploadTransport/u);
  assert.doesNotMatch(source, /src\/server|server-only/u);
});

test("B2A standard transfer remains TUS-free after the dedicated resumable pass", async () => {
  const documentation = await text(documentationPath);
  const contract = await text(contractPath);
  const combined = [
    await text(controllerPath),
    await text(adapterPath),
    documentation,
    contract,
  ].join("\n");

  assert.doesNotMatch(
    combined,
    /tus-js-client|new\s+tus\.Upload|x-signature|findPreviousUploads|resumeFromPreviousUpload/iu,
  );
  assert.match(documentation, /does \*\*not\*\* add a learner UI/iu);
  assert.match(contract, /"databaseMigration": false/u);
  assert.match(contract, /"liveStorageObjectWrite": false/u);
});

test("hosted readiness is read-only and pins zero rows, zero objects and exact intent functions", async () => {
  const source = (await text(readinessPath)).replace(/^--.*$/gmu, "");
  assert.match(source, /^\s*with\s/iu);
  assert.match(source, /phase07_pass2c2b2a_standard_transfer_readiness/u);
  assert.match(source, /then 'PASS'\s+else 'STOP'/u);
  assert.match(source, /upload_intents/u);
  assert.match(source, /project_objects/u);
  assert.match(source, /projectObjectPolicies/u);
  assert.match(source, /definition_md5 = expected_md5/u);
  assert.match(source, /current_project_policies[\s\S]*= 8/u);
  assert.match(source, /rubric_criteria[\s\S]*= 40/u);
  assert.doesNotMatch(
    source,
    /\b(insert|update|delete|create|alter|drop|grant|revoke|truncate|commit|rollback)\b/iu,
  );
});
