import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PROJECT_TUS_TRANSFER_LIMITS,
  createProjectTusTransferController,
  isSafeProjectTusEndpoint,
  isSafeProjectTusPreviousUpload,
  isSafeProjectTusUploadUrl,
  shouldRetryProjectTusRequest,
  validateProjectTusTransferInput,
  type ProjectTusPreviousUpload,
  type ProjectTusUploadSession,
  type ProjectTusUploadSessionInput,
  type ProjectTusUploadTransport,
} from "../src/project-upload/tus-transfer.ts";
import type { ProjectUploadCapability } from "../src/project-upload/types.ts";

const controllerPath = "src/project-upload/tus-transfer.ts";
const adapterPath = "src/project-upload/supabase-tus-transfer.ts";
const barrelPath = "src/project-upload/index.ts";
const documentationPath = "PHASE07_PROJECT_RESUMABLE_TUS_TRANSFER.md";
const contractPath = "PHASE07_PROJECT_RESUMABLE_TUS_TRANSFER_V1.json";
const readinessPath =
  "supabase/verification/phase07-pass2c2b2b-project-resumable-tus-transfer-readiness.sql";

const fixedNow = Date.parse("2026-08-07T05:30:00.000Z");
const endpoint =
  "https://xjesjgpbbkldbjuvnqfq.storage.supabase.co/storage/v1/upload/resumable/sign";
const unsignedEndpoint =
  "https://xjesjgpbbkldbjuvnqfq.storage.supabase.co/storage/v1/upload/resumable";
const uploadUrl = `${endpoint}/9f43d21d-0b86-4de3-9957-109e4b76ff7a`;

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
    name: "project.pdf",
    type: "application/pdf",
    size: PROJECT_TUS_TRANSFER_LIMITS.minimumBytes,
    lastModified: fixedNow - 1_000,
    ...overrides,
  } as File;
}

function capability(
  overrides: Partial<ProjectUploadCapability> = {},
): ProjectUploadCapability {
  return {
    intentId: "11111111-1111-4111-8111-111111111111",
    plannedFileId: "22222222-2222-4222-8222-222222222222",
    versionId: "33333333-3333-4333-8333-333333333333",
    bucketId: "project-submissions",
    objectPath:
      "44444444-4444-4444-8444-444444444444/"
      + "55555555-5555-4555-8555-555555555555/"
      + "33333333-3333-4333-8333-333333333333/"
      + "22222222-2222-4222-8222-222222222222.pdf",
    originalFilename: "project.pdf",
    declaredMime: "application/pdf",
    declaredSizeBytes: PROJECT_TUS_TRANSFER_LIMITS.minimumBytes,
    transferMode: "tus",
    issuedAt: new Date(fixedNow - 60_000).toISOString(),
    capabilityExpiresAt: new Date(fixedNow + 60 * 60 * 1000).toISOString(),
    intentExpiresAt: new Date(fixedNow + 90 * 60 * 1000).toISOString(),
    uploadToken: "signed-upload-token-with-sufficient-length",
    reusedIntent: false,
    ...overrides,
  };
}

function previousUpload(
  expected = capability(),
  overrides: Partial<ProjectTusPreviousUpload> = {},
): ProjectTusPreviousUpload {
  return {
    size: expected.declaredSizeBytes,
    metadata: {
      bucketName: "project-submissions",
      objectName: expected.objectPath,
      contentType: expected.declaredMime,
      cacheControl: "3600",
    },
    creationTime: new Date(fixedNow - 60_000).toISOString(),
    urlStorageKey: "tus::safe-entry",
    uploadUrl,
    parallelUploadUrls: null,
    ...overrides,
  };
}

interface SessionHarness {
  input: ProjectTusUploadSessionInput | null;
  previousUploads: ProjectTusPreviousUpload[];
  startCalls: number;
  pauseCalls: number;
  cancelCalls: number;
  resumed: ProjectTusPreviousUpload[];
  uploadUrl: string | null;
  pauseError: unknown;
  cancelError: unknown;
}

function harnessTransport(
  setup: Partial<SessionHarness> = {},
): { transport: ProjectTusUploadTransport; harness: SessionHarness } {
  const harness: SessionHarness = {
    input: null,
    previousUploads: [],
    startCalls: 0,
    pauseCalls: 0,
    cancelCalls: 0,
    resumed: [],
    uploadUrl: null,
    pauseError: null,
    cancelError: null,
    ...setup,
  };

  const transport: ProjectTusUploadTransport = {
    endpoint,
    supported: true,
    canStorePreviousUploads: true,
    createSession(input) {
      harness.input = input;
      const session: ProjectTusUploadSession = {
        async findPreviousUploads() {
          return harness.previousUploads;
        },
        resumeFromPreviousUpload(previous) {
          harness.resumed.push(previous);
          harness.uploadUrl = previous.uploadUrl;
        },
        start() {
          harness.startCalls += 1;
        },
        async pause() {
          harness.pauseCalls += 1;
          if (harness.pauseError) throw harness.pauseError;
        },
        async cancel() {
          harness.cancelCalls += 1;
          if (harness.cancelError) throw harness.cancelError;
        },
        getUploadUrl() {
          return harness.uploadUrl;
        },
      };
      return session;
    },
  };

  return { transport, harness };
}

async function afterPreparation(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function detailedError(status: number, message = `status ${status}`): unknown {
  return {
    message,
    originalResponse: {
      getStatus: () => status,
    },
  };
}

test("TUS limits preserve the exact standard/TUS split and 6 MiB chunk", () => {
  assert.equal(PROJECT_TUS_TRANSFER_LIMITS.minimumBytes, 6_291_457);
  assert.equal(PROJECT_TUS_TRANSFER_LIMITS.maximumBytes, 41_943_040);
  assert.equal(PROJECT_TUS_TRANSFER_LIMITS.chunkSizeBytes, 6_291_456);
  assert.equal(PROJECT_TUS_TRANSFER_LIMITS.maximumAttemptsPerCapability, 2);
  assert.deepEqual(
    PROJECT_TUS_TRANSFER_LIMITS.requestRetryDelaysMilliseconds,
    [0, 1_500, 3_000],
  );
});

test("TUS validation accepts only exact server capability and matching large File", () => {
  assert.deepEqual(
    validateProjectTusTransferInput(file(), capability(), fixedNow),
    { ok: true },
  );

  assert.equal(
    validateProjectTusTransferInput(
      file({ size: 6_291_456 }),
      capability({ declaredSizeBytes: 6_291_456 }),
      fixedNow,
    ).ok,
    false,
  );
  assert.equal(
    validateProjectTusTransferInput(file(), capability({ transferMode: "standard" }), fixedNow).ok,
    false,
  );
  assert.equal(
    validateProjectTusTransferInput(
      file({ size: 41_943_041 }),
      capability({ declaredSizeBytes: 41_943_041 }),
      fixedNow,
    ).ok,
    false,
  );
  assert.equal(
    validateProjectTusTransferInput(
      file({ name: "different.pdf" }),
      capability(),
      fixedNow,
    ).ok,
    false,
  );
});

test("direct endpoint and upload URLs reject alternate origins and path tricks", () => {
  assert.equal(isSafeProjectTusEndpoint(endpoint), true);
  assert.equal(isSafeProjectTusEndpoint(unsignedEndpoint), false);
  assert.equal(isSafeProjectTusEndpoint(endpoint.replace("https:", "http:")), false);
  assert.equal(
    isSafeProjectTusEndpoint(
      "https://xjesjgpbbkldbjuvnqfq.supabase.co/storage/v1/upload/resumable/sign",
    ),
    false,
  );
  assert.equal(isSafeProjectTusUploadUrl(uploadUrl, endpoint), true);
  assert.equal(
    isSafeProjectTusUploadUrl(`${unsignedEndpoint}/unsafe-id`, endpoint),
    false,
  );
  assert.equal(
    isSafeProjectTusUploadUrl(
      "https://evil.example/storage/v1/upload/resumable/sign/abc",
      endpoint,
    ),
    false,
  );
  assert.equal(isSafeProjectTusUploadUrl(`${endpoint}/%2e%2e/abc`, endpoint), false);
  assert.equal(isSafeProjectTusUploadUrl(`${endpoint}/abc?token=leak`, endpoint), false);
  assert.equal(isSafeProjectTusUploadUrl(endpoint, endpoint), false);
});

test("previous upload must match path, MIME, size, age and safe direct URL", () => {
  const expected = capability();
  const selectedFile = file();
  assert.equal(
    isSafeProjectTusPreviousUpload(
      previousUpload(expected),
      selectedFile,
      expected,
      endpoint,
      fixedNow,
    ),
    true,
  );
  assert.equal(
    isSafeProjectTusPreviousUpload(
      previousUpload(expected, {
        metadata: {
          bucketName: "project-submissions",
          objectName: "another/path.pdf",
          contentType: "application/pdf",
          cacheControl: "3600",
        },
      }),
      selectedFile,
      expected,
      endpoint,
      fixedNow,
    ),
    false,
  );
  assert.equal(
    isSafeProjectTusPreviousUpload(
      previousUpload(expected, {
        creationTime: new Date(
          fixedNow - PROJECT_TUS_TRANSFER_LIMITS.maximumPreviousUploadAgeMilliseconds - 1,
        ).toISOString(),
      }),
      selectedFile,
      expected,
      endpoint,
      fixedNow,
    ),
    false,
  );
  assert.equal(
    isSafeProjectTusPreviousUpload(
      previousUpload(expected, { parallelUploadUrls: [uploadUrl] }),
      selectedFile,
      expected,
      endpoint,
      fixedNow,
    ),
    false,
  );
});

test("request retry policy excludes 409 and all terminal 4xx classes", () => {
  for (const status of [408, 423, 429, 500, 503]) {
    assert.equal(shouldRetryProjectTusRequest(detailedError(status)), true);
  }
  for (const status of [400, 401, 403, 409, 413]) {
    assert.equal(shouldRetryProjectTusRequest(detailedError(status)), false);
  }
  assert.equal(
    shouldRetryProjectTusRequest(new TypeError("Failed to fetch")),
    true,
  );
});

test("controller reports real byte progress below 100 until success", async () => {
  const { transport, harness } = harnessTransport();
  const controller = createProjectTusTransferController(transport, {
    now: () => fixedNow,
  });
  const started = controller.start(file(), capability());
  await afterPreparation();
  assert.equal(harness.startCalls, 1);

  harness.input?.onProgress(3_145_728, 6_291_457);
  assert.deepEqual(controller.getSnapshot().progress, {
    kind: "determinate",
    loadedBytes: 3_145_728,
    totalBytes: 6_291_457,
    percentage: 49,
  });
  harness.input?.onProgress(6_291_457, 6_291_457);
  assert.equal(controller.getSnapshot().progress.percentage, 99);

  harness.uploadUrl = uploadUrl;
  harness.input?.onUploadUrlAvailable(uploadUrl);
  harness.input?.onSuccess({ uploadUrl });
  const completed = await started;
  assert.equal(completed.status, "succeeded");
  assert.deepEqual(completed.progress, {
    kind: "complete",
    loadedBytes: 6_291_457,
    totalBytes: 6_291_457,
    percentage: 100,
  });
});

test("pause uses non-terminating abort and resume reuses the same session", async () => {
  const { transport, harness } = harnessTransport({ uploadUrl });
  const controller = createProjectTusTransferController(transport, {
    now: () => fixedNow,
  });
  const started = controller.start(file(), capability());
  await afterPreparation();
  harness.input?.onProgress(1_000_000, 6_291_457);

  const paused = await controller.pause();
  assert.equal(paused.status, "paused");
  assert.equal(paused.canResume, true);
  assert.equal(harness.pauseCalls, 1);
  assert.equal((await started).status, "paused");

  const resumed = controller.resume();
  assert.equal(harness.startCalls, 2);
  assert.equal(controller.getSnapshot().attempt, 1);
  harness.input?.onSuccess({ uploadUrl });
  assert.equal((await resumed).status, "succeeded");
});

test("cancel terminates the TUS session and is terminal", async () => {
  const { transport, harness } = harnessTransport({ uploadUrl });
  const controller = createProjectTusTransferController(transport, {
    now: () => fixedNow,
  });
  const started = controller.start(file(), capability());
  await afterPreparation();
  const cancelled = await controller.cancel();
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.canResume, false);
  assert.equal(harness.cancelCalls, 1);
  assert.equal((await started).status, "cancelled");
});

test("failed termination is reported without falsely claiming cancellation", async () => {
  const { transport } = harnessTransport({
    uploadUrl,
    cancelError: new Error("termination failed"),
  });
  const controller = createProjectTusTransferController(transport, {
    now: () => fixedNow,
  });
  void controller.start(file(), capability());
  await afterPreparation();
  const result = await controller.cancel();
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "termination-failed");
});

test("safe previous upload is resumed before start", async () => {
  const expected = capability();
  const previous = previousUpload(expected);
  const { transport, harness } = harnessTransport({
    previousUploads: [previous],
  });
  const controller = createProjectTusTransferController(transport, {
    now: () => fixedNow,
  });
  const started = controller.start(file(), expected);
  await afterPreparation();
  assert.deepEqual(harness.resumed, [previous]);
  assert.equal(harness.startCalls, 1);
  assert.equal(controller.getSnapshot().resumedPreviousUpload, true);
  assert.equal(controller.getSnapshot().uploadUrl, uploadUrl);
  harness.input?.onSuccess({ uploadUrl });
  assert.equal((await started).status, "succeeded");
});

test("unsafe previous upload poisons the resume set and is terminated", async () => {
  const expected = capability();
  const { transport, harness } = harnessTransport({
    previousUploads: [previousUpload(expected, {
      uploadUrl: "https://evil.example/storage/v1/upload/resumable/sign/abc",
    })],
  });
  const controller = createProjectTusTransferController(transport, {
    now: () => fixedNow,
  });
  const result = await controller.start(file(), expected);
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "unsafe-resume-url");
  assert.equal(harness.startCalls, 0);
  assert.equal(harness.cancelCalls, 1);
});

test("one controller-level retry creates one fresh session only for retryable failure", async () => {
  const sessions: ReturnType<typeof harnessTransport>[] = [];
  const transport: ProjectTusUploadTransport = {
    endpoint,
    supported: true,
    canStorePreviousUploads: false,
    createSession(input) {
      const built = harnessTransport();
      built.harness.input = input;
      sessions.push(built);
      return built.transport.createSession(input);
    },
  };
  const controller = createProjectTusTransferController(transport, {
    now: () => fixedNow,
  });
  const firstPromise = controller.start(file(), capability());
  await afterPreparation();
  sessions[0]?.harness.input?.onError(detailedError(503));
  const first = await firstPromise;
  assert.equal(first.status, "failed");
  assert.equal(first.canRetry, true);
  assert.equal(first.attempt, 1);

  const secondPromise = controller.retry();
  await afterPreparation();
  assert.equal(sessions.length, 2);
  sessions[1]!.harness.uploadUrl = uploadUrl;
  sessions[1]?.harness.input?.onSuccess({ uploadUrl });
  const second = await secondPromise;
  assert.equal(second.status, "succeeded");
  assert.equal(second.attempt, 2);
  assert.equal(second.canRetry, false);
});

test("409 conflict is terminal and cannot enter controller retry", async () => {
  const { transport, harness } = harnessTransport();
  const controller = createProjectTusTransferController(transport, {
    now: () => fixedNow,
  });
  const started = controller.start(file(), capability());
  await afterPreparation();
  harness.input?.onError(detailedError(409));
  const failed = await started;
  assert.equal(failed.errorCode, "conflict");
  assert.equal(failed.canRetry, false);
  assert.equal((await controller.retry()).attempt, 1);
});

test("one capability starts once and concurrent callers do not create parallel sessions", async () => {
  const { transport, harness } = harnessTransport();
  let sessionCount = 0;
  const counted: ProjectTusUploadTransport = {
    ...transport,
    createSession(input) {
      sessionCount += 1;
      return transport.createSession(input);
    },
  };
  const controller = createProjectTusTransferController(counted, {
    now: () => fixedNow,
  });
  const first = controller.start(file(), capability());
  const second = controller.start(file(), capability());
  await afterPreparation();
  assert.equal(sessionCount, 1);
  harness.uploadUrl = uploadUrl;
  harness.input?.onSuccess({ uploadUrl });
  assert.equal((await first).status, "succeeded");
  assert.equal((await second).status, "succeeded");
  assert.equal(controller.reset(), true);
  const reused = await controller.start(file(), capability());
  assert.equal(reused.errorCode, "capability-reused");
});

test("observer failures cannot break an active transfer", async () => {
  const { transport, harness } = harnessTransport({ uploadUrl });
  const controller = createProjectTusTransferController(transport, {
    now: () => fixedNow,
  });
  controller.subscribe(() => {
    throw new Error("observer failure");
  });
  const started = controller.start(file(), capability());
  await afterPreparation();
  harness.input?.onProgress(1, 6_291_457);
  harness.input?.onSuccess({ uploadUrl });
  assert.equal((await started).status, "succeeded");
});

test("synchronous transport error cannot resurrect or start a returned session", async () => {
  let startCalls = 0;
  let pauseCalls = 0;
  const transport: ProjectTusUploadTransport = {
    endpoint,
    supported: true,
    canStorePreviousUploads: false,
    createSession(input) {
      input.onError({ status: 500, message: "synchronous failure" });
      return {
        async findPreviousUploads() { return []; },
        resumeFromPreviousUpload() {},
        start() { startCalls += 1; },
        async pause() { pauseCalls += 1; },
        async cancel() {},
        getUploadUrl() { return null; },
      };
    },
  };
  const controller = createProjectTusTransferController(transport, {
    now: () => fixedNow,
  });
  const result = await controller.start(file(), capability());
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "server-error");
  assert.equal(result.canRetry, true);
  assert.equal(startCalls, 0);
  assert.equal((await controller.pause()).status, "failed");
  assert.equal(pauseCalls, 0);
});

test("synchronous transport success remains terminal and never starts afterward", async () => {
  let startCalls = 0;
  const transport: ProjectTusUploadTransport = {
    endpoint,
    supported: true,
    canStorePreviousUploads: false,
    createSession(input) {
      input.onSuccess({ uploadUrl });
      return {
        async findPreviousUploads() { return []; },
        resumeFromPreviousUpload() {},
        start() { startCalls += 1; },
        async pause() {},
        async cancel() {},
        getUploadUrl() { return uploadUrl; },
      };
    },
  };
  const controller = createProjectTusTransferController(transport, {
    now: () => fixedNow,
  });
  const result = await controller.start(file(), capability());
  assert.equal(result.status, "succeeded");
  assert.equal(result.progress.percentage, 100);
  assert.equal(startCalls, 0);
  assert.equal((await controller.pause()).status, "succeeded");
});

test("synchronous unsafe upload URL terminates the assigned session before failure", async () => {
  let startCalls = 0;
  let cancelCalls = 0;
  const transport: ProjectTusUploadTransport = {
    endpoint,
    supported: true,
    canStorePreviousUploads: false,
    createSession(input) {
      input.onUploadUrlAvailable(
        "https://attacker.example/storage/v1/upload/resumable/sign/unsafe",
      );
      return {
        async findPreviousUploads() { return []; },
        resumeFromPreviousUpload() {},
        start() { startCalls += 1; },
        async pause() {},
        async cancel() { cancelCalls += 1; },
        getUploadUrl() { return null; },
      };
    },
  };
  const controller = createProjectTusTransferController(transport, {
    now: () => fixedNow,
  });
  const result = await controller.start(file(), capability());
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "unsafe-resume-url");
  assert.equal(startCalls, 0);
  assert.equal(cancelCalls, 1);
});

test("Supabase adapter owns exact signed TUS options and no browser secret", async () => {
  const source = await text(adapterPath);
  assert.match(source, /^"use client";/u);
  assert.match(source, /import \* as tus from "tus-js-client"/u);
  assert.match(source, /\.storage\.supabase\.co\/storage\/v1\/upload\/resumable\/sign/u);
  assert.match(source, /new tus\.Upload\(file/u);
  assert.match(source, /"x-signature": capability\.uploadToken/u);
  assert.match(source, /"archstart-project-tus-v2"/u);
  assert.doesNotMatch(
    source,
    /storage\.supabase\.co\/storage\/v1\/upload\/resumable`/u,
  );
  assert.match(source, /"x-upsert": "false"/u);
  assert.match(source, /bucketName: PROJECT_UPLOAD_BUCKET_ID/u);
  assert.match(source, /objectName: capability\.objectPath/u);
  assert.match(source, /contentType: capability\.declaredMime/u);
  assert.match(source, /chunkSize: PROJECT_TUS_TRANSFER_LIMITS\.chunkSizeBytes/u);
  assert.match(source, /parallelUploads: 1/u);
  assert.match(source, /uploadDataDuringCreation: true/u);
  assert.match(source, /storeFingerprintForResuming: true/u);
  assert.match(source, /removeFingerprintOnSuccess: true/u);
  assert.match(source, /findPreviousUploads/u);
  assert.match(source, /resumeFromPreviousUpload/u);
  assert.match(source, /upload\.abort\(false\)/u);
  assert.match(source, /upload\.abort\(true\)/u);
  assert.match(source, /onShouldRetry: \(error\) => shouldRetryProjectTusRequest\(error\)/u);
  assert.doesNotMatch(
    source,
    /authorization|apikey|publishableKey|createSecretSupabaseClient|SUPABASE_SECRET_KEY|service_role|console\./iu,
  );
});

test("client-safe barrel exposes pure TUS controller but not Supabase adapter", async () => {
  const source = executable(await text(barrelPath));
  assert.match(source, /createProjectTusTransferController/u);
  assert.match(source, /ProjectTusTransferSnapshot/u);
  assert.match(source, /shouldRetryProjectTusRequest/u);
  assert.doesNotMatch(
    source,
    /supabase-tus-transfer|createSupabaseTusUploadTransport|tus-js-client/u,
  );
});

test("dependency and lockfile pin tus-js-client exactly to 4.3.1", async () => {
  const packageJson = JSON.parse(await text("package.json")) as {
    dependencies?: Record<string, string>;
  };
  const lockfile = await text("pnpm-lock.yaml");
  assert.equal(packageJson.dependencies?.["tus-js-client"], "4.3.1");
  assert.match(
    lockfile,
    /tus-js-client:\s*\n\s+specifier: 4\.3\.1\s*\n\s+version: 4\.3\.1/u,
  );
  assert.match(lockfile, /^  tus-js-client@4\.3\.1:/mu);
});

test("B2B source scope adds no UI, route, migration or live upload evidence", async () => {
  const documentation = await text(documentationPath);
  const contract = await text(contractPath);
  assert.match(documentation, /does \*\*not\*\* add a learner UI/iu);
  assert.match(documentation, /does not\s+perform a live TUS upload/iu);
  assert.match(documentation, /upload\/resumable\/sign/iu);
  assert.match(documentation, /unsigned[\s\S]*upload\/resumable/iu);
  assert.match(contract, /"directEndpointShape": "[^"]*upload\/resumable\/sign"/u);
  assert.match(contract, /"unsignedEndpointRejected": "[^"]*upload\/resumable"/u);
  assert.match(contract, /"databaseMigration": false/u);
  assert.match(contract, /"liveStorageObjectWrite": false/u);
  assert.match(contract, /"uiChange": false/u);
  assert.match(contract, /"routeChange": false/u);
});

test("hosted readiness remains read-only with zero rows, objects and policies", async () => {
  const source = (await text(readinessPath)).replace(/^--.*$/gmu, "");
  assert.match(source, /^\s*with\s/iu);
  assert.match(source, /phase07_pass2c2b2b_resumable_tus_readiness/u);
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

test("controller implementation fixes attempt, chunk, progress and terminal conflict contracts", async () => {
  const source = executable(await text(controllerPath));
  assert.match(source, /maximumAttemptsPerCapability: 2/u);
  assert.match(source, /chunkSizeBytes: 6 \* 1024 \* 1024/u);
  assert.match(source, /Math\.min\(99/u);
  assert.match(source, /status === 409/u);
  assert.match(source, /retryable: false/u);
  assert.match(source, /maximumPreviousUploadAgeMilliseconds: 24 \* 60 \* 60 \* 1000/u);
});
