import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  inspectProjectFile,
  validateProjectFilePolicy,
} from "../src/project-upload/file-inspection.ts";
import type {
  ProjectFileDetectedMime,
  ProjectFilePolicySnapshot,
} from "../src/project-upload/finalization-types.ts";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const migration = read(
  "supabase/migrations/20260808120000_phase07_pass2c2c_project_file_inspection_finalization.sql",
);
const verification = read(
  "supabase/verification/phase07-pass2c2c-project-file-inspection-finalization.sql",
);
const runtimeTemplate = read(
  "supabase/verification/phase07-pass2c2c-two-account-file-finalization-template.sql",
);
const finalizationAction = read("src/server/project-file-finalization-action.ts");
const downloadAction = read("src/server/project-file-download-action.ts");
const cleanupAction = read("src/server/project-upload-orphan-cleanup-action.ts");
const sharedAction = read("src/server/project-file-finalization-shared.ts");
const barrel = read("src/project-upload/index.ts");
const finalizerStart = migration.indexOf(
  "create or replace function public.finalize_project_upload_intent(",
);
const finalizerEnd = migration.indexOf(
  "create or replace function public.close_project_upload_intent_after_inspection(",
);
const cleanupStart = migration.indexOf(
  "create or replace function public.list_stale_project_upload_intents(",
);
const cleanupEnd = migration.indexOf(
  "create or replace function public.authorize_project_file_download(",
);
const finalizerSql = migration.slice(finalizerStart, finalizerEnd);
const cleanupSql = migration.slice(cleanupStart, cleanupEnd);

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function png(width = 1_920, height = 1_080): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  writeUint32(bytes, 8, 13);
  bytes.set([73, 72, 68, 82], 12);
  writeUint32(bytes, 16, width);
  writeUint32(bytes, 20, height);
  bytes.set([8, 6, 0, 0, 0], 24);
  writeUint32(bytes, 29, crc32(bytes.subarray(12, 29)));
  return bytes;
}

function pdf(pageCount: number): Uint8Array {
  const objects: string[] = [];
  const pageIds: number[] = [];
  for (let index = 0; index < pageCount; index += 1) pageIds.push(3 + index * 2);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Count ${pageCount} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
  for (let index = 0; index < pageCount; index += 1) {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1920 1080] /Contents ${contentId} 0 R >>`);
    objects.push("<< /Length 0 >>\nstream\n\nendstream");
  }

  let body = "%PDF-1.7\n% ARCH.START deterministic fixture\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "ascii");
}

function policy(overrides: Partial<ProjectFilePolicySnapshot> = {}): ProjectFilePolicySnapshot {
  return {
    declaredMime: "image/png",
    declaredSizeBytes: 33,
    formatType: "SINGLE_BOARD",
    allowedMimeTypes: ["application/pdf", "image/png"],
    maxFileBytes: 41_943_040,
    expectedWidth: 1_920,
    expectedHeight: 1_080,
    minPageCount: 1,
    maxPageCount: 1,
    ...overrides,
  };
}

test("valid PNG signature/IHDR is detected at exact 1920 x 1080", async () => {
  const bytes = png();
  const inspected = await inspectProjectFile(bytes);
  assert.equal(inspected.ok, true);
  if (!inspected.ok) return;
  assert.equal(inspected.detectedMime, "image/png");
  assert.equal(inspected.pixelWidth, 1_920);
  assert.equal(inspected.pixelHeight, 1_080);
  assert.deepEqual(validateProjectFilePolicy(inspected, policy()), { ok: true });
});

test("truncated PNG, wrong signature, and invalid IHDR are rejected", async () => {
  assert.deepEqual(await inspectProjectFile(png().subarray(0, 20)), {
    ok: false,
    reason: "malformed_png",
  });
  const wrongSignature = png();
  wrongSignature[0] = 0;
  assert.deepEqual(await inspectProjectFile(wrongSignature), {
    ok: false,
    reason: "unsupported_actual_mime",
  });
  const badIhdr = png();
  badIhdr[25] = 5;
  assert.deepEqual(await inspectProjectFile(badIhdr), {
    ok: false,
    reason: "malformed_png",
  });
});

test("wrong PNG dimensions are rejected by the frozen policy", async () => {
  const inspected = await inspectProjectFile(png(1_919, 1_080));
  assert.equal(inspected.ok, true);
  if (!inspected.ok) return;
  assert.deepEqual(validateProjectFilePolicy(inspected, policy()), {
    ok: false,
    reason: "invalid_png_dimensions",
  });
});

test("maintained PDF parser accepts deterministic one-page and 8-10-page documents", async () => {
  for (const pageCount of [1, 8, 9, 10]) {
    const bytes = pdf(pageCount);
    const inspected = await inspectProjectFile(bytes);
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    if (!inspected.ok) continue;
    assert.equal(inspected.detectedMime, "application/pdf");
    assert.equal(inspected.pageCount, pageCount);
    const result = validateProjectFilePolicy(inspected, policy({
      declaredMime: "application/pdf",
      declaredSizeBytes: bytes.byteLength,
      formatType: pageCount === 1 ? "SINGLE_BOARD" : "MULTI_PAGE_PACK",
      allowedMimeTypes: ["application/pdf"],
      minPageCount: pageCount === 1 ? 1 : 8,
      maxPageCount: pageCount === 1 ? 1 : 10,
    }));
    assert.deepEqual(result, { ok: true });
  }
});

test("malformed PDF and out-of-policy page count are rejected", async () => {
  const malformed = Buffer.from("%PDF-not-a-document", "ascii");
  assert.deepEqual(await inspectProjectFile(malformed), {
    ok: false,
    reason: "malformed_pdf",
  });

  const bytes = pdf(7);
  const inspected = await inspectProjectFile(bytes);
  assert.equal(inspected.ok, true, JSON.stringify(inspected));
  if (!inspected.ok) return;
  assert.deepEqual(validateProjectFilePolicy(inspected, policy({
    declaredMime: "application/pdf",
    declaredSizeBytes: bytes.byteLength,
    formatType: "MULTI_PAGE_PACK",
    allowedMimeTypes: ["application/pdf"],
    minPageCount: 8,
    maxPageCount: 10,
  })), { ok: false, reason: "invalid_pdf_page_count" });
});

test("actual/declaration size mismatch, MIME mismatch, and SHA-256 are deterministic", async () => {
  const bytes = png();
  const first = await inspectProjectFile(bytes);
  const second = await inspectProjectFile(bytes);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.deepEqual(validateProjectFilePolicy(first, policy({ declaredSizeBytes: 34 })), {
    ok: false,
    reason: "declared_size_mismatch",
  });
  assert.deepEqual(validateProjectFilePolicy(first, policy({
    declaredMime: "application/pdf",
    allowedMimeTypes: ["application/pdf"],
  })), { ok: false, reason: "declared_mime_mismatch" });
});

test("browser-facing actions accept only one UUID and elevated modules are server-only", () => {
  assert.match(sharedAction, /Object\.keys\(record\)\.length !== 1/u);
  assert.match(finalizationAction, /exactUuidInput\(inputValue, "intentId"\)/u);
  assert.match(downloadAction, /exactUuidInput\(inputValue, "fileId"\)/u);
  for (const source of [finalizationAction, downloadAction, cleanupAction]) {
    assert.match(source, /import "server-only";/u);
    assert.doesNotMatch(source, /console\./u);
  }
  assert.doesNotMatch(barrel, /file-inspection|finalization-types|SecretSupabase|pdfjs/u);
});

test("service-only RPCs revoke browser execution and preserve canonical planned identity", () => {
  for (const name of [
    "get_project_upload_finalization_context",
    "finalize_project_upload_intent",
    "close_project_upload_intent_after_inspection",
    "list_stale_project_upload_intents",
    "authorize_project_file_download",
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${name}\\(`, "u"));
  }
  assert.match(migration, /from public, anon, authenticated, service_role;/u);
  assert.match(migration, /to service_role;/u);
  assert.match(migration, /insert into public\.project_submission_files[\s\S]*intent_row\.planned_file_id/u);
  assert.match(migration, /intent_row\.object_path <> canonical_path/u);
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(migration, /for update/gu);
  assert.match(migration, /intent_row\.state = 'finalized'[\s\S]*true/u);
  assert.match(migration, /project version already has a final file/u);
});

test("stable rejection, exact cleanup, and finalized-row exclusion are explicit", () => {
  assert.match(migration, /stable_reasons constant text\[\]/u);
  assert.match(finalizationAction, /remove\(\[objectPath\]\)/u);
  assert.match(finalizationAction, /close_project_upload_intent_after_inspection/u);
  assert.match(cleanupAction, /staleCleanupBatchSize/u);
  assert.match(migration, /p_limit is distinct from 20/u);
  assert.match(migration, /intent_row\.state = 'pending'/u);
  assert.match(migration, /intent_row\.finalized_file_id is null/u);
  assert.match(migration, /not exists \([\s\S]*public\.project_submission_files/u);
  assert.doesNotMatch(`${migration}\n${finalizationAction}`, /raw parser|parser\.message|original_filename\s*=>\s*closed_reason/iu);
});

test("R1 finalizer uses the create-compatible user/version lock order and locked revalidation", () => {
  assert.ok(finalizerStart >= 0 && finalizerEnd > finalizerStart);
  const preRead = finalizerSql.indexOf(
    "select candidate.version_id into pre_read_version_id",
  );
  const advisoryLock = finalizerSql.indexOf("perform pg_catalog.pg_advisory_xact_lock(");
  const versionLock = finalizerSql.indexOf("select version_candidate.* into version_row");
  const submissionLock = finalizerSql.indexOf(
    "select submission_candidate.* into submission_row",
  );
  const intentLock = finalizerSql.indexOf("select candidate.* into intent_row");
  assert.ok(preRead >= 0 && preRead < advisoryLock);
  assert.ok(advisoryLock < versionLock);
  assert.ok(versionLock < submissionLock && submissionLock < intentLock);
  assert.match(
    finalizerSql,
    /pg_advisory_xact_lock\([\s\S]*hashtext\(p_requester_id::text\)[\s\S]*hashtext\(pre_read_version_id::text\)/u,
  );
  assert.doesNotMatch(
    finalizerSql,
    /pg_advisory_xact_lock\([\s\S]*hashtext\(p_intent_id::text\)/u,
  );
  assert.match(finalizerSql, /intent_row\.user_id is distinct from p_requester_id/u);
  assert.match(finalizerSql, /intent_row\.version_id is distinct from pre_read_version_id/u);
  assert.match(
    finalizerSql,
    /intent_row\.submission_id is distinct from version_row\.submission_id/u,
  );
  assert.match(
    finalizerSql,
    /intent_row\.state = 'finalized'[\s\S]*return query select intent_row\.id, intent_row\.planned_file_id, 'finalized'::text, true/u,
  );
  assert.match(finalizerSql, /project version already has a final file/u);
});

test("R1 orphan selector covers closed exact-path objects without protecting a competing orphan", () => {
  assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart);
  assert.match(cleanupSql, /p_limit is distinct from 20/u);
  assert.match(cleanupSql, /array\['admin'\]::text\[\]/u);
  assert.match(cleanupSql, /intent_row\.state in \('pending', 'expired', 'cancelled'\)/u);
  assert.match(cleanupSql, /intent_row\.expires_at <= now\(\)/u);
  assert.match(cleanupSql, /intent_row\.finalized_file_id is null/u);
  assert.match(
    cleanupSql,
    /intent_row\.state = 'pending'[\s\S]*intent_row\.state in \('expired', 'cancelled'\)[\s\S]*from storage\.objects as object_row[\s\S]*object_row\.bucket_id = intent_row\.bucket_id[\s\S]*object_row\.name = intent_row\.object_path/u,
  );
  assert.match(cleanupSql, /file_row\.id = intent_row\.planned_file_id/u);
  assert.match(cleanupSql, /file_row\.bucket_id = intent_row\.bucket_id/u);
  assert.match(cleanupSql, /file_row\.object_path = intent_row\.object_path/u);
  assert.doesNotMatch(cleanupSql, /file_row\.version_id = intent_row\.version_id/u);
  assert.match(cleanupSql, /order by intent_row\.expires_at, intent_row\.id[\s\S]*limit 20/u);
  assert.match(verification, /fdc4c28fff4683cddd3ebccd3aa986a0/u);
  assert.match(verification, /492e48dcdf471fafce0b13ecfda05d30/u);
  assert.match(runtimeTemplate, /LIVE_OBJECT_CLEANUP_ACCEPTANCE=NOT_RUN/u);
});

test("download authorization covers owner/admin/assigned reviewer and identical denial", () => {
  assert.match(migration, /file_row\.user_id = p_requester_id/u);
  assert.match(migration, /array\['admin'\]::text\[\]/u);
  assert.match(migration, /array\['reviewer'\]::text\[\]/u);
  assert.match(migration, /assignment\.reviewer_id = p_requester_id/u);
  assert.match(migration, /assignment\.released_at is null/u);
  assert.match(downloadAction, /status: "denied", message: "Файл недоступен\."/u);
  assert.match(downloadAction, /signedDownloadSeconds/u);
  assert.doesNotMatch(downloadAction, /bucketId:|objectPath:/u);
});

test("read-only verification and rollback-only runtime template cover required boundaries", () => {
  const executableVerification = verification.replace(/^--.*$/gmu, "");
  assert.match(executableVerification, /^\s*with\s/iu);
  assert.doesNotMatch(
    executableVerification,
    /\b(insert|update|delete|create|alter|drop|grant|revoke|truncate|commit|rollback)\b/iu,
  );

  assert.equal((runtimeTemplate.match(/'USER_A_UUID'/gu) ?? []).length, 1);
  assert.equal((runtimeTemplate.match(/'USER_B_UUID'/gu) ?? []).length, 1);
  assert.match(runtimeTemplate, /finalized_retry\.reused is not true/u);
  assert.match(runtimeTemplate, /owner_download_count/u);
  assert.match(runtimeTemplate, /denied_download_count/u);
  assert.match(runtimeTemplate, /unassigned_reviewer_download_count/u);
  assert.match(runtimeTemplate, /assigned_download_count/u);
  assert.match(runtimeTemplate, /released_reviewer_download_count/u);
  assert.match(runtimeTemplate, /admin_download_count/u);

  const adminGrantor = runtimeTemplate.indexOf("(user_a, 'admin', true, user_a)");
  const reviewerRole = runtimeTemplate.indexOf("(user_b, 'reviewer', true, user_a)");
  const unassignedCheck = runtimeTemplate.indexOf("into unassigned_reviewer_download_count");
  const assignment = runtimeTemplate.indexOf("insert into private.project_reviewer_assignments");
  const adminAssignment = runtimeTemplate.indexOf("draft_a.submission_id, user_b, user_a");
  const assignmentAssertion = runtimeTemplate.indexOf("active reviewer assignment was not created");
  const assignedCheck = runtimeTemplate.indexOf("into assigned_download_count");
  const release = runtimeTemplate.indexOf("set released_at = now()");
  const releasedCheck = runtimeTemplate.indexOf("into released_reviewer_download_count");
  const reviewerAdminRole = runtimeTemplate.indexOf("user_b, 'admin', true, user_a");
  const adminCheck = runtimeTemplate.indexOf("into admin_download_count");
  assert.ok(adminGrantor >= 0);
  assert.ok(adminGrantor < reviewerRole);
  assert.ok(reviewerRole < unassignedCheck);
  assert.ok(unassignedCheck < assignment);
  assert.ok(assignment < adminAssignment);
  assert.ok(adminAssignment < assignmentAssertion);
  assert.ok(assignmentAssertion < assignedCheck);
  assert.ok(assignedCheck < release);
  assert.ok(release < releasedCheck);
  assert.ok(releasedCheck < reviewerAdminRole);
  assert.ok(reviewerAdminRole < adminCheck);

  assert.match(runtimeTemplate, /ACTIVE_ADMIN_ASSIGNMENT_AUTHORITY=PASS/u);
  assert.match(runtimeTemplate, /UNASSIGNED_AND_RELEASED_REVIEWER_DENIAL=PASS/u);
  assert.match(runtimeTemplate, /TEMPORARY_OBJECT_AND_ROWS_ROLLED_BACK=PASS/u);
  assert.match(runtimeTemplate, /LIVE_OBJECT_CLEANUP_ACCEPTANCE=NOT_RUN/u);
  assert.match(runtimeTemplate, /ROLLBACK_SENTINEL/u);
  assert.match(runtimeTemplate, /rollback cleanup failed/u);
  assert.match(
    runtimeTemplate,
    /if exists \([\s\S]*from storage\.objects[\s\S]*name = temporary_object_path[\s\S]*unexpected Storage object exists in database-only runtime/u,
  );
  assert.doesNotMatch(runtimeTemplate, /delete\s+from\s+storage\.objects/iu);
  assert.doesNotMatch(
    runtimeTemplate,
    /pg_catalog\.pg_proc|procedure\.prosrc|pg_catalog\.strpos|pre_read_version_id|finalizer_definition|cleanup_definition/iu,
  );

  assert.match(verification, /verificationRevision', 'R1E6_CATALOG_HASH'/u);
  assert.match(verification, /procedure\.prosrc/u);
  assert.match(verification, /actualBodyMd5/u);
  assert.match(verification, /bodyMatches/u);
  assert.match(verification, /migrationAppliedExactly/u);
  assert.match(verification, /private_bucket_matches/u);
  assert.match(verification, /project_storage_policy_count/u);
  assert.match(verification, /authenticated_intent_select/u);
  assert.match(verification, /current_policy_count/u);
  assert.match(verification, /rubric_criterion_count/u);
  assert.doesNotMatch(
    verification,
    /repair_source|repair_contract|pg_catalog\.strpos|pre_read_version_id|finalizer_definition|cleanup_definition/u,
  );
  assert.doesNotMatch(`${verification}\n${runtimeTemplate}`, /pg_get_functiondef/u);
});

test("pdfjs and its exact Node canvas runtime are pinned without widening product scope", () => {
  const packageJson = JSON.parse(read("package.json")) as {
    dependencies?: Record<string, string>;
  };
  const lockfile = read("pnpm-lock.yaml");
  assert.equal(packageJson.dependencies?.["pdfjs-dist"], "6.2.108");
  assert.equal(packageJson.dependencies?.["@napi-rs/canvas"], "1.0.3");
  assert.match(lockfile, /pdfjs-dist:\s*\n\s+specifier: 6\.2\.108\s*\n\s+version: 6\.2\.108/u);
  assert.match(
    lockfile,
    /'@napi-rs\/canvas':\s*\n\s+specifier: 1\.0\.3\s*\n\s+version: 1\.0\.3/u,
  );
  const combined = `${migration.replace(/^--.*$/gmu, "")}\n${finalizationAction}\n${downloadAction}\n${cleanupAction}`;
  assert.doesNotMatch(combined, /certificate|verification registry|revocation|sendEmail|nodemailer|vercel/iu);
  assert.doesNotMatch(combined, /sb_secret_[A-Za-z0-9_-]+|BEGIN PRIVATE KEY/gu);
});

test("detected MIME union remains exactly PDF and PNG", () => {
  const allowed: ProjectFileDetectedMime[] = ["application/pdf", "image/png"];
  assert.deepEqual(allowed, ["application/pdf", "image/png"]);
});
