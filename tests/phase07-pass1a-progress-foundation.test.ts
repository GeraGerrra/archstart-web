import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260804210000_phase07_pass1a_progress_foundation.sql",
  ),
  "utf8",
);

const verification = readFileSync(
  join(
    root,
    "supabase/verification/phase07-pass1a-progress-foundation.sql",
  ),
  "utf8",
);

test("Phase 07 Pass 1A creates the exact hidden course catalogs", () => {
  assert.match(migration, /private\.course_modules/u);
  assert.match(migration, /private\.course_lessons/u);
  assert.match(migration, /private\.course_projects/u);
  assert.match(migration, /generate_series\(1, 8\)/u);
  assert.match(migration, /generate_series\(1, 5\)/u);
  assert.match(migration, /revoke all on schema private from public, anon, authenticated/u);
});

test("lesson activity uses own-row RLS and column-limited writes", () => {
  assert.match(migration, /alter table public\.lesson_activity enable row level security/u);
  assert.match(migration, /lesson_activity_select_own/u);
  assert.match(migration, /lesson_activity_insert_own/u);
  assert.match(migration, /lesson_activity_update_own/u);
  assert.match(migration, /grant insert \(lesson_code, last_item\)/u);
  assert.match(migration, /grant update \(last_item\)/u);
  assert.doesNotMatch(
    migration,
    /grant\s+(?:all|insert|update|delete)\s+on\s+(?:table\s+)?public\.lesson_activity\s+to\s+anon/iu,
  );
});

test("activity identity and timestamps remain database-owned", () => {
  assert.match(migration, /private\.stamp_lesson_activity/u);
  assert.match(migration, /new\.user_id := current_user_id/u);
  assert.match(migration, /new\.lesson_code := old\.lesson_code/u);
  assert.match(migration, /new\.last_visited_at := now\(\)/u);
  assert.match(migration, /security definer/u);
  assert.match(migration, /set search_path = ''/u);
});

test("the exposed activity RPC is invoker-scoped and authenticated-only", () => {
  assert.match(migration, /public\.record_lesson_activity/u);
  assert.match(migration, /security invoker/u);
  assert.match(migration, /grant execute on function public\.record_lesson_activity\(text, text\)\s+to authenticated/iu);
  assert.match(migration, /revoke all on function public\.record_lesson_activity\(text, text\)\s+from public, anon, authenticated/iu);
});

test("Pass 1A does not start completion, quiz-attempt, project-review or certificate persistence", () => {
  for (const forbidden of [
    "lesson_completions",
    "module_completions",
    "quiz_attempts",
    "project_submissions",
    "project_review_events",
    "certificates",
  ]) {
    assert.doesNotMatch(migration, new RegExp(`create\\s+table[^;]*${forbidden}`, "iu"));
  }
});

test("hosted verification covers catalogs, RLS, grants, RPC and zero initial rows", () => {
  assert.match(verification, /module_count/u);
  assert.match(verification, /lesson_count/u);
  assert.match(verification, /project_count/u);
  assert.match(verification, /pg_policies/u);
  assert.match(verification, /has_column_privilege/u);
  assert.match(verification, /has_function_privilege/u);
  assert.match(verification, /lesson_activity_rows/u);
});
