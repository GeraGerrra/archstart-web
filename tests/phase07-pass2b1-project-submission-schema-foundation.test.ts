import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260805210000_phase07_pass2b1_project_submission_schema_foundation.sql",
  ),
  "utf8",
);

const verification = readFileSync(
  join(
    root,
    "supabase/verification/phase07-pass2b1-project-submission-schema-foundation.sql",
  ),
  "utf8",
);

const twoAccount = readFileSync(
  join(
    root,
    "supabase/verification/phase07-pass2b1-two-account-project-foundation-template.sql",
  ),
  "utf8",
);

const policy = JSON.parse(
  readFileSync(
    join(root, "PHASE07_PROJECT_SUBMISSION_POLICY_V1.json"),
    "utf8",
  ),
) as {
  projects: Array<{
    projectCode: string;
    formatType: string;
    allowedMimeTypes: string[];
    maxFileBytes: number;
    minPageCount: number;
    maxPageCount: number;
    supportingTextMinWords: number;
    supportingTextMaxWords: number;
  }>;
  statusMachine: { transitions: string[][] };
};

test("Pass 2B1 requires the accepted Phase 07 progress/Quiz/completion foundation", () => {
  for (const relation of [
    "private.course_modules",
    "private.course_lessons",
    "private.course_projects",
    "public.lesson_activity",
    "public.quiz_attempts",
    "public.lesson_completions",
    "public.module_completions",
  ]) {
    assert.match(migration, new RegExp(relation.replace(".", "\\."), "u"));
  }
  assert.match(migration, /Accepted Phase 07 Pass 1A–1E foundations are required/u);
});

test("Pass 2B1 creates the exact private and learner-owned project authorities", () => {
  for (const table of [
    "private.project_submission_policies",
    "private.project_rubric_criteria",
    "private.project_staff_roles",
    "private.project_reviewer_assignments",
    "public.project_submissions",
    "public.project_submission_versions",
    "public.project_submission_files",
    "public.project_reviews",
    "public.project_review_criteria",
    "public.project_status_events",
  ]) {
    assert.match(migration, new RegExp(`create table ${table.replace(".", "\\.")}`, "u"));
  }
});

test("one logical submission, one draft, one file, and immutable submitted versions are enforced", () => {
  assert.match(migration, /unique \(user_id, project_code\)/u);
  assert.match(migration, /project_submission_one_draft_idx/u);
  assert.match(migration, /version_id uuid not null unique/u);
  assert.match(migration, /submitted project versions are immutable/u);
  assert.match(migration, /primary_file_count = 1/u);
});

test("accepted eight-project policy preserves PDF\/PNG, M02 text, M08 pages, and 40 MB", () => {
  assert.equal(policy.projects.length, 8);
  assert.ok(policy.projects.every((entry) => entry.maxFileBytes === 41_943_040));

  const m02 = policy.projects.find((entry) => entry.projectCode === "M02_P02");
  assert.equal(m02?.supportingTextMinWords, 120);
  assert.equal(m02?.supportingTextMaxWords, 180);

  const m08 = policy.projects.find((entry) => entry.projectCode === "M08_P08");
  assert.deepEqual(m08?.allowedMimeTypes, ["application/pdf"]);
  assert.equal(m08?.formatType, "MULTI_PAGE_PACK");
  assert.equal(m08?.minPageCount, 8);
  assert.equal(m08?.maxPageCount, 10);

  assert.match(migration, /max_file_bytes between 1 and 41943040/u);
  assert.match(migration, /from public\.lesson_completions as completion/u);
  assert.match(migration, /lesson\.module_code = project\.module_code/u);
  assert.match(migration, /declared_mime in \('application\/pdf', 'image\/png'\)/u);
  assert.match(migration, /detected_mime = declared_mime/u);
  assert.match(migration, /lower\(original_filename\).*\\.pdf\$/su);
  assert.doesNotMatch(migration, /image\/jpeg|application\/zip|video\/mp4/u);
});

test("all eight exact rubrics contain five criteria totaling 100 points", () => {
  const rubricSeeds = migration.match(
    /\('M0[1-8]_P0[1-8]', 1, [1-5],/gu,
  );
  assert.equal(rubricSeeds?.length, 40);
  for (const projectCode of [
    "M01_P01", "M02_P02", "M03_P03", "M04_P04",
    "M05_P05", "M06_P06", "M07_P07", "M08_P08",
  ]) {
    assert.match(migration, new RegExp(projectCode, "u"));
  }
  assert.match(migration, /count\(\*\) <> 5 or sum\(max_points\) <> 100/u);
});

test("state machine is explicit, accepted is terminal, and direct status changes require authorization", () => {
  assert.deepEqual(policy.statusMachine.transitions, [
    ["draft", "submitted"],
    ["submitted", "under_review"],
    ["under_review", "revisions_required"],
    ["under_review", "accepted"],
    ["under_review", "not_accepted"],
    ["revisions_required", "resubmitted"],
    ["not_accepted", "resubmitted"],
    ["resubmitted", "under_review"],
  ]);
  assert.match(migration, /project_submission_transition_is_allowed/u);
  assert.match(migration, /archstart\.project_transition_authorized/u);
  assert.match(migration, /invalid project submission status transition/u);
  assert.match(migration, /new project versions require a draft or revision state/u);
  assert.doesNotMatch(migration, /when p_from_status = 'accepted'/u);
});

test("reviewer authority is private, self-review is blocked, and learner profiles are not authorization", () => {
  assert.match(migration, /create table private\.project_staff_roles/u);
  assert.match(migration, /staff_role in \('reviewer', 'admin'\)/u);
  assert.match(migration, /granted_by uuid not null/u);
  assert.match(migration, /new\.granted_by := old\.granted_by/u);
  assert.match(migration, /reviewers cannot review their own project submission/u);
  assert.match(migration, /'submitted',\s*'resubmitted',\s*'under_review'/u);
  assert.match(migration, /project status event version does not belong to the submission/u);
  assert.doesNotMatch(migration, /alter table public\.profiles[\s\S]*add column[\s\S]*role/iu);
  assert.doesNotMatch(migration, /raw_user_meta_data|app_metadata|custom access token/iu);
});

test("all public project tables use own-row RLS and browser writes remain disabled", () => {
  const rlsStatements = migration.match(
    /alter table public\.project_[a-z_]+ enable row level security;/gu,
  );
  assert.equal(rlsStatements?.length, 6);

  const ownPolicies = migration.match(
    /using \(\(select auth\.uid\(\)\) = user_id\)/gu,
  );
  assert.equal(ownPolicies?.length, 6);
  assert.match(migration, /project_review_criteria_user_recent_idx/u);
  assert.match(migration, /project_submission_versions_policy_idx/u);

  assert.doesNotMatch(
    migration,
    /grant\s+(?:insert|update|delete|all)[^;]*to authenticated/iu,
  );
  assert.match(migration, /to service_role/u);
});

test("object paths, reviewer identity, and actor identity are hidden with column privileges", () => {
  assert.match(migration, /grant select \([\s\S]*original_filename[\s\S]*\)\s+on public\.project_submission_files\s+to authenticated/iu);
  assert.doesNotMatch(
    migration.match(/grant select \([\s\S]*?\)\s+on public\.project_submission_files\s+to authenticated/iu)?.[0] ?? "",
    /object_path|bucket_id/u,
  );
  assert.doesNotMatch(
    migration.match(/grant select \([\s\S]*?\)\s+on public\.project_reviews\s+to authenticated/iu)?.[0] ?? "",
    /reviewer_id/u,
  );
  assert.doesNotMatch(
    migration.match(/grant select \([\s\S]*?\)\s+on public\.project_status_events\s+to authenticated/iu)?.[0] ?? "",
    /actor_id/u,
  );
});

test("Pass 2B1 does not create Storage, UI, notification, certificate, or public workflow RPCs", () => {
  for (const forbidden of [
    "insert into storage.buckets",
    "create policy",
    "create table public.learner_notifications",
    "create table public.certificates",
    "create or replace function public.create_project_draft",
    "create or replace function public.submit_project",
  ]) {
    if (forbidden === "create policy") continue;
    assert.doesNotMatch(migration, new RegExp(forbidden.replaceAll(".", "\\."), "iu"));
  }
  assert.match(migration, /Pass 2B1 must not create the private Storage bucket/u);
});

test("hosted verification and transaction template cover grants, RLS, rollback, isolation, and invariants", () => {
  assert.match(verification, /current_policy_count/u);
  assert.match(verification, /rubric_criterion_count/u);
  assert.match(verification, /learner_can_select_object_path/u);
  assert.match(verification, /project_storage_bucket_absent/u);
  assert.match(verification, /submission_rows/u);

  assert.match(twoAccount, /USER_A_UUID/gu);
  assert.match(twoAccount, /USER_B_UUID/gu);
  assert.match(twoAccount, /authenticated project insert was unexpectedly accepted/u);
  assert.match(twoAccount, /invalid draft-to-accepted transition/u);
  assert.match(twoAccount, /project submission prerequisite was unexpectedly bypassed/u);
  assert.match(twoAccount, /insert into public\.lesson_completions/u);
  assert.match(twoAccount, /self-review assignment/u);
  assert.match(twoAccount, /submitted version mutation/u);
  assert.match(twoAccount, /rollback;/u);
});

test("Pass 2B1 sources contain no credentials", () => {
  const combined = `${migration}
${verification}
${twoAccount}`;
  assert.doesNotMatch(
    combined,
    /sb_secret_|sb_publishable_|cfut_|BEGIN PRIVATE KEY|re_[A-Za-z0-9_-]{20,}/gu,
  );
});
