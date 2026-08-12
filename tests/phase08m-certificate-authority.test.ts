import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");

const migration = read("supabase/migrations/20260810040000_phase08m_certificate_authority.sql");
const verification = read("supabase/verification/phase08m-certificate-authority.sql");
const twoAccount = read("supabase/verification/phase08m-two-account-certificate-authority-template.sql");
const scope = read("PHASE08M_CERTIFICATE_SCOPE_LOCK.md");
const authority = JSON.parse(read("PHASE08M_CERTIFICATE_AUTHORITY_V1.json")) as {
  acceptedBase: { gitHead: string; gitTree: string };
  eligibility: {
    canonicalLessonsRequired: number;
    canonicalAcceptedProjectsRequired: number;
    quizScoreThreshold: number | null;
  };
  publicRpcs: string[];
  excluded: string[];
};

test("Phase 08M is pinned to the closed Phase 07 main authority", () => {
  assert.equal(authority.acceptedBase.gitHead, "ffae1946ceba5ce3d0f06e811f2b637b178b4c09");
  assert.equal(authority.acceptedBase.gitTree, "b7d5bcd48d9063dbd169035e340914f2bf712202");
  assert.match(scope, /Phase 07 status: closed/u);
  assert.match(scope, /M08 accepted file remains attached[\s\S]*remains `draft`/u);
});

test("one exact learner-owned certificate table is created without Storage", () => {
  assert.equal((migration.match(/create table public\.course_certificates/gu) ?? []).length, 1);
  assert.match(migration, /user_id uuid not null unique/u);
  assert.match(migration, /certificate_code text not null unique/u);
  assert.match(migration, /\^as-\[0-9a-f\]\{32\}\$/u);
  assert.match(migration, /course_code = 'ARCHSTART_CORE'/u);
  assert.match(migration, /course_version = '2026\.08'/u);
  assert.match(migration, /one lifetime ARCH\.START Certificate/iu);
  assert.doesNotMatch(migration, /insert into storage\.buckets|create policy[\s\S]*storage\./iu);
});

test("eligibility is exact 40 canonical lessons plus 8 accepted projects and a profile name", () => {
  assert.equal(authority.eligibility.canonicalLessonsRequired, 40);
  assert.equal(authority.eligibility.canonicalAcceptedProjectsRequired, 8);
  assert.equal(authority.eligibility.quizScoreThreshold, null);
  assert.match(migration, /from private\.course_lessons as lesson[\s\S]*join public\.lesson_completions/u);
  assert.match(migration, /from private\.course_projects as project[\s\S]*submission\.current_status = 'accepted'/u);
  assert.match(migration, /eligibility\.required_lessons = 40/u);
  assert.match(migration, /eligibility\.required_projects = 8/u);
  assert.match(migration, /eligibility\.profile_name_ready/u);
  assert.doesNotMatch(migration, /quiz_attempts|score\s*[><=]|minimum score/iu);
});

test("browser identity is parameter-free and database-owned", () => {
  assert.deepEqual(authority.publicRpcs, [
    "public.get_my_course_certificate_eligibility()",
    "public.issue_my_course_certificate()",
    "public.verify_course_certificate(text)",
    "public.revoke_course_certificate(text,text)",
  ]);
  assert.match(migration, /current_user_id uuid := \(select auth\.uid\(\)\)/u);
  const issueStart = migration.indexOf("create or replace function public.issue_my_course_certificate");
  const verifyStart = migration.indexOf("create or replace function public.verify_course_certificate");
  const issueBody = migration.slice(issueStart, verifyStart);
  assert.match(issueBody, /create or replace function public\.issue_my_course_certificate\(\)/u);
  assert.doesNotMatch(issueBody, /p_user_id|p_display_name|p_eligible|p_issued_at|p_certificate_code/u);
});

test("issuance is serialized, idempotent, snapshot-based, and terminal after revocation", () => {
  assert.match(migration, /from public\.profiles as profile[\s\S]*for update/u);
  assert.match(migration, /from public\.course_certificates as certificate[\s\S]*for update/u);
  assert.match(migration, /certificate_row\.id is not null[\s\S]*true;/u);
  assert.match(migration, /display_name_snapshot[\s\S]*eligibility\.display_name/u);
  assert.match(migration, /course certificate has been revoked/u);
  assert.doesNotMatch(migration, /delete from public\.course_certificates|revoked_at\s*=\s*null/iu);
});

test("public verification is minimal and unknown codes return no row", () => {
  const verifyStart = migration.indexOf("create or replace function public.verify_course_certificate");
  const revokeStart = migration.indexOf("create or replace function public.revoke_course_certificate");
  const verifyBody = migration.slice(verifyStart, revokeStart);
  for (const required of [
    "certificate_code",
    "display_name_snapshot",
    "course_title_snapshot",
    "course_version",
    "issued_at",
    "certificate_status",
    "VALID",
    "REVOKED",
  ]) assert.match(verifyBody, new RegExp(required, "u"));
  assert.doesNotMatch(verifyBody, /user_id|email|revocation_reason|project_|quiz_|reviewer/iu);
  assert.doesNotMatch(verifyBody, /raise exception/iu);
});

test("RLS and grants deny direct writes and reserve revocation for service_role", () => {
  assert.match(migration, /alter table public\.course_certificates enable row level security/u);
  assert.match(migration, /course_certificates_select_own/u);
  assert.match(migration, /grant select \([\s\S]*certificate_code[\s\S]*\)[\s\S]*to authenticated/iu);
  assert.doesNotMatch(
    migration.match(/grant select \([\s\S]*?\)[\s\S]*?to authenticated;/iu)?.[0] ?? "",
    /user_id|revocation_reason/u,
  );
  const grantsStart = migration.indexOf("-- Exact grants");
  const commentsStart = migration.indexOf("comment on table public.course_certificates");
  const grants = migration.slice(grantsStart, commentsStart);
  assert.match(grants, /grant execute on function public\.verify_course_certificate\(text\)[\s\S]*to anon, authenticated, service_role/u);
  assert.match(grants, /grant execute on function public\.revoke_course_certificate\(text, text\)[\s\S]*to service_role/u);
  assert.doesNotMatch(grants, /grant execute on function public\.revoke_course_certificate\(text, text\)[\s\S]*to authenticated/iu);
});

test("hosted verification covers exact catalog, functions, grants, zero rows, and no certificate bucket", () => {
  assert.match(verification, /expected_columns/u);
  assert.match(verification, /private\.course_lessons\) <> 40/u);
  assert.match(verification, /private\.course_projects\) <> 8/u);
  assert.match(verification, /has_column_privilege/u);
  assert.match(verification, /has_function_privilege/u);
  assert.match(verification, /certificate_row_count <> 0/u);
  assert.match(verification, /certificate_storage_bucket_count <> 0/u);
  assert.match(verification, /phase08m_certificate_authority/u);
});

test("two-account template proves locked isolation and ineligible issuance denial without persistent rows", () => {
  assert.match(twoAccount, /USER_A_UUID/gu);
  assert.match(twoAccount, /USER_B_UUID/gu);
  assert.match(twoAccount, /certificate_state <> 'locked'/u);
  assert.match(twoAccount, /public\.issue_my_course_certificate\(\)/gu);
  assert.match(twoAccount, /when check_violation/u);
  assert.match(twoAccount, /ZERO_CERTIFICATE_ROWS_PRESERVED=PASS/u);
  assert.match(twoAccount, /rollback;\s*$/u);
});

test("the MVP scope excludes the overengineered certificate backlog and contains no credentials", () => {
  for (const excluded of [
    "server_pdf",
    "certificate_storage_bucket",
    "qr_code",
    "email",
    "manual_certificate_approval",
    "certificate_admin_ui",
    "public_registry",
    "certificate_reissue",
    "phase09",
  ]) assert.ok(authority.excluded.includes(excluded));

  const combined = `${migration}\n${verification}\n${twoAccount}\n${scope}`;
  assert.doesNotMatch(
    combined,
    /sb_secret_|sb_publishable_|BEGIN PRIVATE KEY|re_[A-Za-z0-9_-]{20,}/gu,
  );
  assert.doesNotMatch(combined, /create table public\.(?:certificate_requests|certificate_approvals)|send_email|qr_code/iu);
});
