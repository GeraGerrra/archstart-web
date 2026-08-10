import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const migration = read("supabase/migrations/20260809120000_phase07_r3_private_projection_bridge.sql");
const verification = read("supabase/verification/phase07-r3-private-projection-bridge.sql");
const projection = read("src/server/project-workspace-projection.ts");
const dashboardStaff = read("src/server/dashboard-project-staff-projection.ts");
const actions = read("src/server/project-workspace-actions.ts");

const bridgeSignatures = [
  "public.get_project_submission_policy_for_service(text)",
  "public.get_project_staff_roles_for_service(uuid)",
  "public.list_active_project_staff_for_service()",
  "public.list_active_project_reviewer_assignments_for_service()",
  "public.list_project_rubric_criteria_for_service(text[])",
] as const;

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
}

test("one transactional migration creates the exact five read-only bridge signatures", () => {
  assert.match(migration, /^begin;/u);
  assert.match(migration, /commit;\s*$/u);
  assert.equal((migration.match(/create or replace function public\./gu) ?? []).length, 5);
  for (const signature of bridgeSignatures) {
    assert.ok(migration.includes(signature.replace(/\((?:text\[\]|text|uuid)\)$/u, "("))
      || migration.includes(signature));
    assert.ok(verification.includes(signature));
  }
  assert.equal((migration.match(/\nlanguage sql\n/gu) ?? []).length, 5);
  assert.equal((migration.match(/\nstable\nsecurity definer\nset search_path = ''/gu) ?? []).length, 5);
  assert.doesNotMatch(migration, /auth\.uid\(|current_user|request\.jwt/iu);
});

test("all bridge functions deny browser roles and allow only service_role execution", () => {
  assert.equal((migration.match(/from public, anon, authenticated;/gu) ?? []).length, 5);
  assert.equal((migration.match(/to service_role;/gu) ?? []).length, 5);
  assert.doesNotMatch(migration, /grant\s+(?:usage|select|execute)[\s\S]*?to\s+(?:anon|authenticated)/iu);
  assert.match(verification, /privilege\.grantee = 0[\s\S]*?privilege\.privilege_type = 'EXECUTE'/u);
  assert.match(verification, /has_schema_privilege\('anon', 'private', 'USAGE'\)/u);
  assert.match(verification, /has_schema_privilege\('authenticated', 'private', 'USAGE'\)/u);
});

test("application source contains no private-schema Data API call", () => {
  const applicationSource = ["app", "src"].flatMap((directory) =>
    readdirSync(join(root, directory), { recursive: true, encoding: "utf8" })
      .filter((path) => /\.(?:[cm]?[jt]sx?)$/u.test(path))
      .map((path) => read(join(directory, path))),
  ).join("\n");
  assert.doesNotMatch(applicationSource, /\.schema\(["']private["']\)/u);
});

test("policy, dashboard and mutation authorization use the exact bounded RPCs", () => {
  assert.match(projection, /\.rpc\(\s*"get_project_submission_policy_for_service",\s*\{ p_project_code: projectCode \}/u);
  assert.match(dashboardStaff, /\.rpc\(\s*"get_project_staff_roles_for_service",\s*\{ p_user_id: userId \}/u);
  assert.match(actions, /\.rpc\(\s*"get_project_staff_roles_for_service",\s*\{ p_user_id: userId \}/u);
});

test("staff projection uses only the active staff, assignment and rubric bridges", () => {
  assert.match(projection, /\.rpc\("list_active_project_staff_for_service"\)/u);
  assert.match(projection, /\.rpc\("list_active_project_reviewer_assignments_for_service"\)/u);
  assert.match(projection, /\.rpc\("list_project_rubric_criteria_for_service", \{[\s\S]*?p_project_codes: rubricProjectCodes/u);
});

test("bridge errors fail closed and anonymous learner projection avoids elevated reads", () => {
  assert.match(projection, /if \(error \|\| !policy\) throw new Error\("Active project policy is unavailable\."\)/u);
  assert.match(projection, /if \(ownRoleError\) throw new Error\("Staff authorization is unavailable\."\)/u);
  assert.match(dashboardStaff, /return !error && Array\.isArray\(data\) && data\.length > 0;/u);
  assert.match(actions, /if \(error \|\| !Array\.isArray\(data\)\) return null;/u);
  const learnerStart = projection.indexOf("export async function loadLearnerProjectWorkspaceProjection");
  const staffStart = projection.indexOf("export async function loadStaffProjectWorkspaceProjection");
  const learnerProjection = projection.slice(learnerStart, staffStart);
  assert.ok(learnerProjection.indexOf("if (!session) return { kind: \"anonymous\"")
    < learnerProjection.indexOf("activePolicy(projectCode)"));
});

test("verification preserves exact catalogs, QA roles and empty project/storage state", () => {
  assert.match(verification, /policy_count <> 8/u);
  assert.match(verification, /rubric_count <> 40/u);
  assert.match(verification, /active_staff_count <> 2/u);
  assert.match(verification, /project_row_count <> 0/u);
  assert.match(verification, /project_storage_object_count <> 0/u);
});

test("R3 bridge remains unchanged while the later bounded progress UI repair supersedes its deferred fixture", () => {
  const shell = read("src/prototypes/selected-a/shell-adapter.tsx");
  assert.match(shell, /ANONYMOUS_SHELL_PROGRESS_PROJECTION/u);
  assert.doesNotMatch(shell, /lesson\.moduleCode === "M04"/u);
  assert.equal(sha256("src/learning/review/StaffProjectWorkspace.tsx"), "badce5bda8bd655f5f7cf883157e444c2e946b7c1159de011904084ceb44ca80");
  assert.doesNotMatch(`${migration}\n${verification}\n${projection}\n${dashboardStaff}\n${actions}`, /phase08|certificate|verification_registry/iu);
});
