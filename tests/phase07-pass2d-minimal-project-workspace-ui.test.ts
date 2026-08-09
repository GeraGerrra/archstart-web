import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  PROJECT_FILE_LIMITS,
  projectCodeForModule,
  projectSupportingTextWordCount,
} from "../src/project-workspace/policy.ts";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const projectPage = read("app/prototype/a/course/[moduleCode]/project/page.tsx");
const overview = read("src/learning/project/ProjectOverviewPage.tsx");
const learner = read("src/learning/project/ProjectWorkspace.tsx");
const staff = read("src/learning/review/StaffProjectWorkspace.tsx");
const projection = read("src/server/project-workspace-projection.ts");
const actions = read("src/server/project-workspace-actions.ts");
const dashboard = read("src/server/dashboard-projection.ts");
const reviewRoute = read("app/prototype/a/review/page.tsx");
const shell = read("src/prototypes/selected-a/shell-adapter.tsx");

test("public project content remains present while the real workspace is appended", () => {
  assert.match(projectPage, /SelectedAProject/u);
  assert.ok(projectPage.includes("workspaceContent={<ProjectWorkspace projection={projection} />}") );
  assert.match(overview, /\{workspaceContent\}/u);
  assert.doesNotMatch(overview, /disabled aria-describedby="project-submission-description"/u);
});

test("anonymous projection returns before profile, policy, learner or staff reads", () => {
  const sessionCheck = projection.indexOf("if (!session) return { kind: \"anonymous\"");
  const profileRead = projection.indexOf('.from("profiles")', sessionCheck);
  const policyRead = projection.indexOf("activePolicy(projectCode)", sessionCheck);
  assert.ok(sessionCheck >= 0 && sessionCheck < profileRead && profileRead < policyRead);
  assert.match(learner, /projection\.kind === "anonymous"/u);
});

test("signed-in learner project queries rely on own-row RLS without hidden user_id filters", () => {
  for (const table of [
    "project_submissions",
    "project_submission_versions",
    "project_submission_files",
    "project_reviews",
    "project_review_criteria",
  ]) {
    const start = projection.indexOf(`.from("${table}")`);
    assert.notEqual(start, -1);
    const nextFrom = projection.indexOf('.from("', start + 1);
    const chain = projection.slice(start, nextFrom === -1 ? start + 700 : nextFrom);
    assert.doesNotMatch(chain, /\.eq\("user_id", session\.userId\)/u);
  }
  assert.match(projection, /\.from\("project_submissions"\)[\s\S]*?\.eq\("project_code", projectCode\)/u);
});

test("browser mutation payloads cannot choose user, bucket, path, role or authority", () => {
  assert.match(actions, /exactObject\(inputValue, \["projectCode"\]\)/u);
  assert.match(actions, /exactObject\(inputValue, \["versionId", "learnerNote", "supportingText"\]\)/u);
  assert.match(actions, /\{ p_user_id: userId \}/u);
  assert.doesNotMatch(actions, /p_user_id:\s*input|p_bucket|p_object_path|p_staff_role/u);
  assert.doesNotMatch(learner, /userId:|bucketId:|objectPath:|reviewerAuthority:/u);
});

test("no client workspace imports the secret Supabase client", () => {
  for (const source of [learner, staff]) {
    assert.match(source, /^"use client";/u);
    assert.doesNotMatch(source, /supabase\/admin|createSecretSupabaseClient|SUPABASE_SECRET_KEY/u);
  }
});

test("standard and TUS selection preserves the accepted exact 6 MiB boundary", () => {
  assert.equal(PROJECT_FILE_LIMITS.standardMaximumBytes, 6_291_456);
  assert.match(learner, /capabilityResult\.capability\.transferMode === "standard"/u);
  assert.match(learner, /createSupabaseProjectStandardTransferController/u);
  assert.match(learner, /createSupabaseProjectTusTransferController/u);
});

test("TUS pause, resume and cancel controls call the accepted controller", () => {
  assert.match(learner, /controller\[transition\]\(\)/u);
  assert.match(learner, /controlTusUpload\("pause"\)/u);
  assert.match(learner, /controlTusUpload\("resume"\)/u);
  assert.match(learner, /controlTusUpload\("cancel"\)/u);
  assert.match(learner, /tusSnapshot\.progress\.percentage/u);
});

test("finalization follows success or a safe reused-intent exact-path conflict", () => {
  const starts = [...learner.matchAll(/await controller\.start/gu)].map((match) => match.index);
  const successChecks = [...learner.matchAll(/if \(snapshot\.status === "succeeded"\)/gu)].map((match) => match.index);
  assert.equal(starts.length, 2);
  assert.ok(successChecks.length >= 3);
  for (let index = 0; index < 2; index += 1) {
    assert.ok((starts[index] ?? 0) < (successChecks[index] ?? 0));
  }
  assert.match(learner, /isReusableIntentConflict\(snapshot, capabilityResult\.capability\.reusedIntent\)/u);
  assert.match(learner, /await finalizeTransfer\(capabilityResult\.capability\.intentId\)/u);
});

test("M02 word count and M08 PDF-only policy are represented", () => {
  assert.equal(projectSupportingTextWordCount("один  два\nтри"), 3);
  assert.equal(projectCodeForModule("M02"), "M02_P02");
  assert.equal(projectCodeForModule("m08"), "M08_P08");
  assert.match(learner, /120–180 слов/u);
  assert.match(learner, /projection\.projectCode === "M08_P08"[\s\S]*application\/pdf/u);
});

test("learner submit and resubmit wrappers use only the accepted RPCs", () => {
  assert.match(actions, /"submit_project"/u);
  assert.match(actions, /"resubmit_project"/u);
  assert.match(actions, /"create_project_draft"/u);
  assert.match(actions, /"create_project_revision_draft"/u);
  assert.match(actions, /"update_project_draft"/u);
  assert.doesNotMatch(actions, /\.from\([^)]*\)\s*\.insert|\.from\([^)]*\)\s*\.update/u);
});

test("review form requires exactly five database rubric criteria", () => {
  assert.match(projection, /parsed\.length === 5/u);
  assert.match(staff, /assignment\.criteria\.length === 5/u);
  assert.match(actions, /criteria\.length !== 5/u);
  assert.match(actions, /criterionNumber !== index \+ 1/u);
});

test("non-staff and unassigned staff cannot receive review data", () => {
  const roleCheck = projection.indexOf("if (!role) return { kind: \"denied\" }");
  const assignmentRead = projection.indexOf('.rpc("list_active_project_reviewer_assignments_for_service")', roleCheck);
  assert.ok(roleCheck >= 0 && roleCheck < assignmentRead);
  assert.match(projection, /activeAssignmentRows\.filter\([\s\S]*?uuid\(row\.reviewer_id\) === session\.userId/u);
  assert.match(reviewRoute, /projection\.kind === "denied"\) redirect/u);
});

test("admin assignment uses the accepted RPC without direct table writes", () => {
  assert.match(actions, /rpc\("assign_project_reviewer"/u);
  assert.match(actions, /activeStaffRole\(session\.userId, \["admin"\]\)/u);
  assert.doesNotMatch(actions, /project_reviewer_assignments[\s\S]*?\.(insert|update|delete)\(/u);
});

test("learner and staff downloads reuse the existing signed-download action", () => {
  assert.match(learner, /requestLearnerProjectFileDownloadAction\(\{ fileId \}\)/u);
  assert.match(staff, /requestProjectFileDownloadAction\(\{ fileId \}\)/u);
  assert.doesNotMatch(`${learner}\n${staff}`, /createSignedUrl|objectPath/u);
});

test("pass adds no migration, dependency, email, certificate or Phase 08 source", () => {
  assert.equal(readdirSync(join(root, "supabase/migrations")).filter((name) => /pass2d/iu.test(name)).length, 0);
  assert.equal(createHash("sha256").update(readFileSync(join(root, "package.json"))).digest("hex"), "abb7040d3cef0fcba7854bb88940ffd61a26c5c9b035d7bd81b85812e6862971");
  assert.equal(createHash("sha256").update(readFileSync(join(root, "pnpm-lock.yaml"))).digest("hex"), "ce4d86a7db28e6e5b9c4b79a24196b23440256f8ade490b955c8d9f89d4832f2");
  assert.doesNotMatch(`${actions}\n${projection}\n${learner}\n${staff}`, /sendEmail|certificate|verification_registry|phase08/iu);
});

test("known anonymous M01/M04 sidebar fixture remains byte-identical", () => {
  assert.equal(createHash("sha256").update(shell).digest("hex"), "a35eec7da567e2fd96b1ba28da0de4a02a620743927f309d994994c5cdb81954");
  assert.match(shell, /lesson\.moduleCode === "M04" \? "complete" : "available"/u);
});

test("protected route and dashboard expose only role-authorized staff entry", () => {
  assert.match(reviewRoute, /requireOnboardedProfile\("\/prototype\/a\/review"\)/u);
  assert.match(projection, /createSecretSupabaseClient\(\)/u);
  assert.match(dashboard, /hasActiveProjectStaffRole\(userId\)/u);
  assert.match(dashboard, /staffReviewAction: hasStaffRole/u);
});
