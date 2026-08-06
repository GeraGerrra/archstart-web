import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260806010000_phase07_pass2b2_project_submission_workflow_activation.sql",
  ),
  "utf8",
);

const verification = readFileSync(
  join(
    root,
    "supabase/verification/phase07-pass2b2-project-submission-workflow-activation.sql",
  ),
  "utf8",
);

const twoAccount = readFileSync(
  join(
    root,
    "supabase/verification/phase07-pass2b2-two-account-project-workflow-template.sql",
  ),
  "utf8",
);

const contract = JSON.parse(
  readFileSync(
    join(root, "PHASE07_PROJECT_SUBMISSION_WORKFLOW_V1.json"),
    "utf8",
  ),
) as {
  acceptedSource: {
    gitHead: string;
    currentProjectPolicies: number;
    rubricCriteria: number;
    projectWorkflowRows: number;
    projectStorageBucketExists: boolean;
  };
  statusMachine: {
    transitions: string[][];
    acceptedTerminal: boolean;
    notAcceptedResubmittable: boolean;
  };
  rpcSurface: Array<{
    signature: string;
    caller: string;
  }>;
  security: {
    anonExecuteCount: number;
    authenticatedExecuteCount: number;
    serviceRoleOnlyRpcCount: number;
    authenticatedDirectProjectDml: boolean;
  };
  fileBoundary: {
    storageBucketCreated: boolean;
    storagePoliciesCreated: boolean;
  };
};

const expectedRpcNames = [
  "set_project_staff_role",
  "create_project_draft",
  "update_project_draft",
  "submit_project",
  "create_project_revision_draft",
  "resubmit_project",
  "assign_project_reviewer",
  "begin_project_review",
  "decide_project_review",
] as const;

test("Pass 2B2 is pinned to the accepted B1 hosted and Git identity", () => {
  assert.equal(
    contract.acceptedSource.gitHead,
    "8e26589e2e4a7688cbeb789b2511f021df813f99",
  );
  assert.equal(contract.acceptedSource.currentProjectPolicies, 8);
  assert.equal(contract.acceptedSource.rubricCriteria, 40);
  assert.equal(contract.acceptedSource.projectWorkflowRows, 0);
  assert.equal(contract.acceptedSource.projectStorageBucketExists, false);

  assert.match(migration, /Accepted Phase 07 Pass 2B1 project schema foundation/u);
  assert.match(migration, /project_policy_count <> 8 or rubric_count <> 40/u);
  assert.match(migration, /clean zero-row project workflow boundary/u);
  assert.match(migration, /ba8e1f472cbb6fbd4cddf313289778f4/u);
  assert.match(migration, /fd2f9322adbd13ca9ba2836a53cc14bf/u);
  assert.match(migration, /a82fd3909a8fd1db3bd99f37a3acf330/u);
  assert.match(migration, /b1_function_match_count <> 17/u);
  assert.match(migration, /project_trigger_count <> 16/u);
  assert.match(migration, /normally_enabled_trigger_count <> 16/u);
  assert.match(migration, /e7f3a5072ae7a8f00a0d1d7052e6344f/u);
});

test("exactly nine narrow public workflow RPCs are created", () => {
  const created = [...migration.matchAll(
    /create or replace function public\.([a-z0-9_]+)\(/gu,
  )].map((match) => match[1]);

  assert.deepEqual(created, expectedRpcNames);
  assert.equal(contract.rpcSurface.length, 9);

  for (const name of expectedRpcNames) {
    assert.match(
      migration,
      new RegExp(`create or replace function public\\.${name}\\(`, "u"),
    );
  }
});

test("all workflow RPCs are hardened security-definer functions", () => {
  assert.equal(migration.match(/language plpgsql/gu)?.length, 9);
  assert.equal(migration.match(/security definer/gu)?.length, 9);
  assert.equal(migration.match(/set search_path = ''/gu)?.length, 9);

  for (const relation of [
    "private.project_staff_roles",
    "private.project_reviewer_assignments",
    "private.project_submission_policies",
    "private.project_rubric_criteria",
    "public.project_submissions",
    "public.project_submission_versions",
    "public.project_submission_files",
    "public.project_reviews",
    "public.project_review_criteria",
    "public.project_status_events",
    "auth.users",
  ]) {
    assert.match(migration, new RegExp(relation.replaceAll(".", "\\."), "u"));
  }

  assert.doesNotMatch(migration, /execute format|dynamic sql|\bsearch_path\s*=\s*public/iu);
});

test("function privileges expose eight session RPCs and one service-only bootstrap RPC", () => {
  assert.equal(contract.security.anonExecuteCount, 0);
  assert.equal(contract.security.authenticatedExecuteCount, 8);
  assert.equal(contract.security.serviceRoleOnlyRpcCount, 1);
  assert.equal(contract.security.authenticatedDirectProjectDml, false);

  assert.match(
    migration,
    /revoke all on function[\s\S]*from public, anon, authenticated, service_role;/u,
  );
  assert.match(
    migration,
    /grant execute on function[\s\S]*decide_project_review\(uuid, text, text, jsonb\)[\s\S]*to authenticated;/u,
  );
  assert.match(
    migration,
    /set_project_staff_role\(uuid, text, boolean, uuid\)[\s\S]*to service_role;/u,
  );
  assert.doesNotMatch(
    migration.match(
      /grant execute on function[\s\S]*?to authenticated;/u,
    )?.[0] ?? "",
    /set_project_staff_role/u,
  );
});

test("learner identity and workflow authority are never client-owned", () => {
  for (const signature of [
    "create_project_draft\\(\\s*p_project_code text",
    "update_project_draft\\(\\s*p_version_id uuid",
    "submit_project\\(\\s*p_version_id uuid",
    "create_project_revision_draft\\(\\s*p_submission_id uuid",
    "resubmit_project\\(\\s*p_version_id uuid",
  ]) {
    assert.match(migration, new RegExp(signature, "u"));
  }

  assert.match(migration, /current_user_id uuid := \(select auth\.uid\(\)\)/u);
  assert.doesNotMatch(
    migration,
    /create_project_draft\([\s\S]{0,160}p_user_id|submit_project\([\s\S]{0,160}p_user_id/iu,
  );
  const decisionSignature = migration.match(
    /create or replace function public\.decide_project_review\(([\s\S]*?)\)\nreturns table/u,
  )?.[1] ?? "";
  assert.doesNotMatch(
    decisionSignature,
    /p_score|p_reviewer_id|p_user_id/iu,
  );
  assert.doesNotMatch(migration, /raw_user_meta_data|app_metadata|profiles\.role/iu);
});

test("ownership and assignment filters precede protected row locks", () => {
  const updateDraft = migration.match(
    /create or replace function public\.update_project_draft\([\s\S]*?\n\$function\$;/u,
  )?.[0] ?? "";
  const beginReview = migration.match(
    /create or replace function public\.begin_project_review\([\s\S]*?\n\$function\$;/u,
  )?.[0] ?? "";
  const decideReview = migration.match(
    /create or replace function public\.decide_project_review\([\s\S]*?\n\$function\$;/u,
  )?.[0] ?? "";

  assert.match(
    updateDraft,
    /where version\.id = p_version_id\s+and version\.user_id = current_user_id\s+for update of submission, version/u,
  );
  assert.doesNotMatch(updateDraft, /owner_version/u);

  assert.match(
    beginReview,
    /where submission\.id = p_submission_id[\s\S]*assignment\.reviewer_id = current_user_id[\s\S]*for update/u,
  );

  const staffCheckPosition = decideReview.indexOf(
    "private.project_staff_has_role",
  );
  const submissionLockPosition = decideReview.indexOf(
    "select\n    submission.current_version_id",
  );
  assert.ok(staffCheckPosition >= 0);
  assert.ok(submissionLockPosition > staffCheckPosition);
  assert.match(
    decideReview,
    /assignment\.reviewer_id = current_user_id[\s\S]*review\.reviewer_id = current_user_id[\s\S]*for update of submission, version/u,
  );
});

test("the accepted state machine remains explicit and accepted stays terminal", () => {
  assert.deepEqual(contract.statusMachine.transitions, [
    ["draft", "submitted"],
    ["submitted", "under_review"],
    ["under_review", "revisions_required"],
    ["under_review", "accepted"],
    ["under_review", "not_accepted"],
    ["revisions_required", "resubmitted"],
    ["not_accepted", "resubmitted"],
    ["resubmitted", "under_review"],
  ]);
  assert.equal(contract.statusMachine.acceptedTerminal, true);
  assert.equal(contract.statusMachine.notAcceptedResubmittable, true);

  assert.match(migration, /found_submission_status <> 'draft'/u);
  assert.match(migration, /'revisions_required',\s*'not_accepted'/u);
  assert.match(migration, /current_status = 'resubmitted'/u);
  assert.match(migration, /found_submission_status <> 'under_review'/u);
  assert.doesNotMatch(migration, /accepted[^\n]*resubmitted|accepted[^\n]*under_review/iu);
});

test("submission reuses the accepted file and 5-of-5 prerequisite with no score floor", () => {
  assert.match(migration, /project_version_submit_authorized/u);
  assert.match(migration, /private\.project_version_meets_submission_policy/u);
  assert.doesNotMatch(migration, /minimum_score|score\s*[><=]+\s*[0-9]+|quiz score threshold/iu);

  assert.match(twoAccount, /submission without 5\/5 lesson completions/u);
  assert.match(twoAccount, /score,\s*question_count[\s\S]*\n\s*0,\s*\n\s*5,/u);
  assert.match(twoAccount, /ACCEPTED_WITH_SCORE_5_NO_THRESHOLD=PASS/u);
});

test("locking, unique constraints, and exact retry branches prevent duplicates", () => {
  assert.match(migration, /pg_advisory_xact_lock/gu);
  assert.match(migration, /for update of submission, version/gu);
  assert.match(migration, /for update;/gu);
  assert.match(migration, /existing project draft version is not editable/u);
  assert.match(migration, /a different immutable review already exists/u);
  assert.match(migration, /found_submission_status = normalized_decision/u);
  assert.match(migration, /active_reviewer_id = p_reviewer_id/u);

  for (const marker of [
    "initial project draft retry created a duplicate",
    "reviewer-assignment retry created a duplicate",
    "first review or its retry is invalid",
    "revision-draft retry created a duplicate version",
    "accepted review or post-release retry is invalid",
    "workflow row/event cardinality or retry idempotency is invalid",
  ]) {
    assert.match(twoAccount, new RegExp(marker, "u"));
  }
});

test("review decisions accept only five bounded criterion inputs and compute database score", () => {
  assert.match(migration, /jsonb_array_length\(p_criteria\) <> 5/u);
  assert.match(migration, /unsupported field/u);
  assert.match(migration, /count\(distinct criterion_number\)/u);
  assert.match(migration, /awarded_points > max_points/u);
  assert.match(migration, /coalesce\(sum\(awarded_points\), 0\)/u);
  assert.match(migration, /insert into public\.project_review_criteria/u);
  assert.match(migration, /'database-owned'/u);
  assert.match(migration, /computed_score::smallint/u);
  assert.match(migration, /normalized_decision = 'accepted'/u);
  assert.match(migration, /assignment_released/u);

  assert.doesNotMatch(
    migration.match(
      /create or replace function public\.decide_project_review\([\s\S]*?returns table/u,
    )?.[0] ?? "",
    /p_score|p_rubric_version|p_user_id|p_reviewer_id/u,
  );
});

test("reviewer and admin authority stays private and self-review remains blocked", () => {
  assert.match(migration, /private\.project_staff_has_role/u);
  assert.match(migration, /array\['admin'\]::text\[\]/u);
  assert.match(migration, /array\['reviewer', 'admin'\]::text\[\]/u);
  assert.match(migration, /reviewers cannot review their own project submission/u);
  assert.match(migration, /project review is not assigned to the authenticated user/u);
  assert.match(migration, /project review is not authorized for the authenticated user/u);
  assert.match(migration, /release active reviewer assignments before revoking/u);
  assert.match(twoAccount, /reviewer unexpectedly received learner-row visibility/u);
});

test("Pass 2B2 creates no Storage, upload, UI, email, gallery, or certificate surface", () => {
  assert.equal(contract.fileBoundary.storageBucketCreated, false);
  assert.equal(contract.fileBoundary.storagePoliciesCreated, false);

  for (const forbidden of [
    /insert into storage\.buckets/iu,
    /create policy[\s\S]*storage\.objects/iu,
    /create table[\s\S]*certificate/iu,
    /create table[\s\S]*notification/iu,
    /create table[\s\S]*gallery/iu,
    /signed[_ -]?url/iu,
    /tus[_ -]?upload/iu,
    /next_public_/iu,
    /resend/iu,
  ]) {
    assert.doesNotMatch(migration, forbidden);
  }

  assert.match(migration, /Pass 2B2 must not activate project Storage/u);
});

test("hosted verification proves function, privilege, B1, trigger, row, and Storage boundaries", () => {
  for (const marker of [
    "workflowRpcCount",
    "workflowRpcs",
    "privilegeSummary",
    "b1FunctionIdentity",
    "triggerSummary",
    "rowCounts",
    "storageBoundary",
    "authenticatedWorkflowExecuteCount",
    "projectBucketExists",
  ]) {
    assert.match(verification, new RegExp(marker, "u"));
  }

  assert.match(verification, /then 'PASS'\s+else 'STOP'/u);
  assert.match(verification, /enabledNormally/u);
  assert.match(verification, /actual_md5 = expected_md5/u);
  assert.match(verification, /authenticatedCanInsertSubmissions/u);
});

test("two-account test is one rollback transaction without temporary-table fragility", () => {
  assert.match(twoAccount, /^begin;/mu);
  assert.match(twoAccount, /USER_A_UUID/gu);
  assert.match(twoAccount, /USER_B_UUID/gu);
  assert.match(twoAccount, /set_project_staff_role/gu);
  assert.match(twoAccount, /create_project_draft/gu);
  assert.match(twoAccount, /submit_project/gu);
  assert.match(twoAccount, /assign_project_reviewer/gu);
  assert.match(twoAccount, /begin_project_review/gu);
  assert.match(twoAccount, /decide_project_review/gu);
  assert.match(twoAccount, /create_project_revision_draft/gu);
  assert.match(twoAccount, /resubmit_project/gu);
  assert.match(twoAccount, /submitted project version was unexpectedly mutable/u);
  assert.match(twoAccount, /rollback;/u);
  assert.match(twoAccount, /staff_roles_after_rollback/u);
  assert.match(twoAccount, /lesson_completions_after_rollback/u);
  assert.doesNotMatch(twoAccount, /create temporary table|on commit drop/iu);
});

test("migration and verification sources have balanced control delimiters", () => {
  assert.equal(migration.match(/\$function\$/gu)?.length, 18);
  assert.equal(migration.match(/\$phase07\$/gu)?.length, 4);
  assert.equal(twoAccount.match(/\$phase07\$/gu)?.length, 2);
  assert.match(migration, /^begin;/mu);
  assert.match(migration, /commit;\s*$/u);
  assert.match(twoAccount, /rollback;/u);
});

test("Pass 2B2 source contains no credential-shaped values", () => {
  const combined = `${migration}\n${verification}\n${twoAccount}`;
  assert.doesNotMatch(
    combined,
    /sb_secret_|sb_publishable_|cfut_|BEGIN PRIVATE KEY|re_[A-Za-z0-9_-]{20,}/gu,
  );
});
