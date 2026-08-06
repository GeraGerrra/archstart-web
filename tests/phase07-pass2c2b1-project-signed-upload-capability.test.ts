import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const actionPath = "src/server/project-upload-capability-action.ts";
const typesPath = "src/project-upload/types.ts";
const barrelPath = "src/project-upload/index.ts";
const readinessPath =
  "supabase/verification/phase07-pass2c2b1-project-signed-upload-capability-readiness.sql";

async function text(path: string): Promise<string> {
  return readFile(path, "utf8");
}

function executable(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\/\/.*$/gmu, "");
}

test("signed capability action is a strict server-only boundary", async () => {
  const source = await text(actionPath);
  assert.match(source, /^"use server";\s+\nimport "server-only";/u);
  assert.match(source, /createServerSupabaseClient/u);
  assert.match(source, /createSecretSupabaseClient/u);
  assert.match(source, /requestProjectUploadCapabilityAction/u);
});

test("authentication precedes intent creation and secret Storage client use", async () => {
  const source = executable(await text(actionPath));
  const action = source.slice(
    source.indexOf("export async function requestProjectUploadCapabilityAction"),
  );
  const claims = action.indexOf("auth.getClaims()");
  const intentCreation = action.indexOf("createIntent(sessionClient");
  const secretClient = action.indexOf("createSecretSupabaseClient()");
  const sign = action.indexOf(".createSignedUploadUrl(");
  assert.ok(claims >= 0);
  assert.ok(intentCreation > claims);
  assert.ok(secretClient > intentCreation);
  assert.ok(sign > secretClient);
});

test("browser input owns no identity, path, bucket, mode, state, expiry or token", async () => {
  const source = await text(typesPath);
  const input = source.match(
    /export interface ProjectUploadCapabilityInput \{[\s\S]*?\n\}/u,
  );
  assert.ok(input);
  assert.match(input[0], /versionId: string/u);
  assert.match(input[0], /originalFilename: string/u);
  assert.match(input[0], /declaredMime: ProjectUploadMime/u);
  assert.match(input[0], /declaredSizeBytes: number/u);
  assert.doesNotMatch(
    input[0],
    /userId|submissionId|plannedFileId|bucketId|objectPath|transferMode|state|expires|token|secret/iu,
  );
});

test("database RPC owns intent creation and stale retries are cancelled narrowly", async () => {
  const source = executable(await text(actionPath));
  assert.match(source, /rpc\("create_project_upload_intent"/u);
  assert.match(source, /rpc\("cancel_project_upload_intent"/u);
  assert.match(source, /minimumFreshIntentMilliseconds/u);
  assert.match(source, /intent\.reused/u);
  assert.doesNotMatch(source, /\.schema\("private"\)|from\("project_upload_intents"\)/u);
});

test("secret client mints one exact non-upsert signed capability", async () => {
  const source = executable(await text(actionPath));
  assert.match(source, /PROJECT_UPLOAD_BUCKET_ID/u);
  assert.match(source, /\.from\(PROJECT_UPLOAD_BUCKET_ID\)/u);
  assert.match(source, /\.createSignedUploadUrl\(intent\.object_path, \{ upsert: false \}\)/u);
  assert.match(source, /signedData\.token/u);
  assert.match(source, /signedData\.path !== intent\.object_path/u);
});

test("capability pass performs no Storage object mutation", async () => {
  const source = executable(await text(actionPath));
  assert.doesNotMatch(
    source,
    /\.upload\(|\.uploadToSignedUrl\(|\.update\(|\.remove\(|storage\.objects/iu,
  );
  assert.doesNotMatch(source, /createSignedUrl\(/u);
});

test("client-safe barrel exposes types and constants but no server action", async () => {
  const source = executable(await text(barrelPath));
  assert.match(source, /PROJECT_UPLOAD_BUCKET_ID/u);
  assert.match(source, /ProjectUploadCapabilityResult/u);
  assert.doesNotMatch(source, /src\/server|server-only|requestProjectUploadCapabilityAction/u);
});

test("token and secret material cannot be logged or sourced from browser input", async () => {
  const action = executable(await text(actionPath));
  const types = executable(await text(typesPath));
  assert.doesNotMatch(action, /console\.|logger|SUPABASE_SECRET_KEY|process\.env/u);
  assert.doesNotMatch(types, /SUPABASE_SECRET_KEY|service_role|sb_secret_/u);
  assert.match(types, /uploadToken: string/u);
  assert.doesNotMatch(types, /userId: string/u);
});

test("no dependency or lockfile change is needed before browser transport", async () => {
  const packageJson = await text("package.json");
  const lockfile = await text("pnpm-lock.yaml");
  assert.doesNotMatch(packageJson, /tus-js-client|uppy/iu);
  assert.doesNotMatch(lockfile, /tus-js-client|@uppy\//iu);
});

test("hosted readiness is read-only and preserves zero-row, empty-bucket boundaries", async () => {
  const source = (await text(readinessPath)).replace(/^--.*$/gmu, "");
  assert.match(source, /^\s*with\s/iu);
  assert.match(source, /phase07_pass2c2b1_signed_upload_readiness/u);
  assert.match(source, /project_upload_intents/u);
  assert.match(source, /project_objects/u);
  assert.match(source, /project_object_policies/u);
  assert.match(source, /then 'PASS'\s+else 'STOP'/u);
  assert.doesNotMatch(
    source,
    /\b(insert|update|delete|create|alter|drop|grant|revoke|truncate|commit|rollback)\b/iu,
  );
});
