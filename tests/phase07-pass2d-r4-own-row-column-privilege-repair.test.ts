import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const foundation = read(
  "supabase/migrations/20260805210000_phase07_pass2b1_project_submission_schema_foundation.sql",
);
const learnerProjection = read("src/server/project-workspace-projection.ts");
const dashboardProjection = read("src/server/dashboard-projection.ts");

function tableChain(source: string, table: string, maximumLength = 700): string {
  const start = source.indexOf(`.from("${table}")`);
  assert.notEqual(start, -1, `missing query for ${table}`);
  const nextFrom = source.indexOf('.from("', start + 1);
  const end = nextFrom === -1
    ? Math.min(source.length, start + maximumLength)
    : Math.min(nextFrom, start + maximumLength);
  return source.slice(start, end);
}

test("authenticated project reads intentionally hide database-owned user_id columns", () => {
  const submissionGrant = foundation.match(
    /grant select \([\s\S]*?\)\s*on public\.project_submissions\s*to authenticated;/u,
  )?.[0] ?? "";
  assert.match(submissionGrant, /\bid\b/u);
  assert.match(submissionGrant, /\bproject_code\b/u);
  assert.match(submissionGrant, /\bcurrent_version_id\b/u);
  assert.match(submissionGrant, /\bcurrent_status\b/u);
  assert.doesNotMatch(submissionGrant, /\buser_id\b/u);

  for (const table of [
    "project_submission_versions",
    "project_submission_files",
    "project_reviews",
    "project_review_criteria",
  ]) {
    const grant = foundation.match(
      new RegExp(
        `grant select \\([\\s\\S]*?\\)\\s*on public\\.${table}\\s*to authenticated;`,
        "u",
      ),
    )?.[0] ?? "";
    assert.ok(grant, `missing authenticated column grant for ${table}`);
    assert.doesNotMatch(grant, /\buser_id\b/u);
  }
});

test("own-row RLS remains the identity boundary for every learner project table", () => {
  const ownRowPolicies = [
    ["project_submissions", "project_submissions_select_own"],
    ["project_submission_versions", "project_submission_versions_select_own"],
    ["project_submission_files", "project_submission_files_select_own"],
    ["project_reviews", "project_reviews_select_own"],
    ["project_review_criteria", "project_review_criteria_select_own"],
  ] as const;

  for (const [table, policy] of ownRowPolicies) {
    assert.match(
      foundation,
      new RegExp(
        `create policy "${policy}"[\\s\\S]*?on public\\.${table}[\\s\\S]*?using \\(\\(select auth\\.uid\\(\\)\\) = user_id\\);`,
        "u",
      ),
    );
  }
});

test("learner project queries do not filter on hidden user_id columns", () => {
  for (const table of [
    "project_submissions",
    "project_submission_versions",
    "project_submission_files",
    "project_reviews",
    "project_review_criteria",
  ]) {
    assert.doesNotMatch(
      tableChain(learnerProjection, table),
      /\.eq\("user_id",\s*session\.userId\)/u,
      `${table} must rely on own-row RLS instead of a hidden user_id filter`,
    );
  }

  assert.match(
    tableChain(learnerProjection, "project_submissions"),
    /\.eq\("project_code", projectCode\)/u,
  );
  assert.match(
    tableChain(learnerProjection, "project_submission_versions"),
    /\.eq\("submission_id", submissionId\)/u,
  );
  assert.match(
    tableChain(learnerProjection, "project_reviews"),
    /\.eq\("version_id", currentVersion\.id\)/u,
  );
});

test("dashboard project status query also relies on project own-row RLS", () => {
  const chain = tableChain(dashboardProjection, "project_submissions", 300);
  assert.match(chain, /\.select\("project_code,current_status"\)/u);
  assert.doesNotMatch(chain, /\.eq\("user_id",\s*userId\)/u);
});

test("the repair changes no database grant, migration, UI or Phase 08 boundary", () => {
  assert.doesNotMatch(
    `${learnerProjection}\n${dashboardProjection}`,
    /grant\s|revoke\s|create\s+(?:or\s+replace\s+)?function|phase08/iu,
  );
});
