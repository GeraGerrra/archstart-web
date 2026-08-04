import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260805010000_phase07_pass1b_completion_foundation.sql",
  ),
  "utf8",
);

const verification = readFileSync(
  join(
    root,
    "supabase/verification/phase07-pass1b-completion-foundation.sql",
  ),
  "utf8",
);

const rlsTemplate = readFileSync(
  join(
    root,
    "supabase/verification/phase07-pass1b-two-account-completion-template.sql",
  ),
  "utf8",
);

test("Pass 1B requires the accepted Pass 1A hosted foundation", () => {
  assert.match(migration, /private\.course_modules/u);
  assert.match(migration, /private\.course_lessons/u);
  assert.match(migration, /private\.course_projects/u);
  assert.match(migration, /public\.lesson_activity/u);
  assert.match(
    migration,
    /Phase 07 Pass 1A foundation is required/u,
  );
  assert.match(
    migration,
    /module_count <> 8[\s\S]*lesson_count <> 40[\s\S]*project_count <> 8/u,
  );
});

test("Pass 1B creates only immutable lesson and module completion tables", () => {
  assert.match(
    migration,
    /create table public\.lesson_completions/u,
  );
  assert.match(
    migration,
    /create table public\.module_completions/u,
  );
  assert.match(
    migration,
    /primary key \(user_id, lesson_code\)/u,
  );
  assert.match(
    migration,
    /primary key \(user_id, module_code\)/u,
  );
  assert.match(
    migration,
    /completion rows are immutable/u,
  );

  for (const forbidden of [
    "quiz_attempts",
    "project_submissions",
    "project_review_events",
    "certificates",
  ]) {
    assert.doesNotMatch(
      migration,
      new RegExp(`create\\s+table[^;]*${forbidden}`, "iu"),
    );
  }
});

test("module completion requires all five lesson completions", () => {
  assert.match(
    migration,
    /required_lesson_count <> 5/u,
  );
  assert.match(
    migration,
    /completed_lesson_count <> required_lesson_count/u,
  );
  assert.match(
    migration,
    /module completion requires all five lesson completions/u,
  );
});

test("removing a lesson completion invalidates its module completion", () => {
  assert.match(
    migration,
    /invalidate_module_completion_after_lesson_delete/u,
  );
  assert.match(
    migration,
    /after delete on public\.lesson_completions/u,
  );
  assert.match(
    migration,
    /delete from public\.module_completions/u,
  );
});

test("browser completion writes remain disabled until the secure activation pass", () => {
  assert.match(
    migration,
    /grant select on table[\s\S]*public\.lesson_completions,[\s\S]*public\.module_completions[\s\S]*to authenticated/gu,
  );

  assert.doesNotMatch(
    migration,
    /grant\s+(?:insert|update|delete|all)[\s\S]{0,160}public\.(?:lesson_completions|module_completions)/iu,
  );

  assert.doesNotMatch(
    migration,
    /create or replace function public\.(?:complete|undo)_/iu,
  );
});

test("own-row RLS exists for both read surfaces", () => {
  assert.match(
    migration,
    /lesson_completions_select_own/u,
  );
  assert.match(
    migration,
    /module_completions_select_own/u,
  );

  const ownRowPredicates = migration.match(
    /using \(\(select auth\.uid\(\)\) = user_id\)/gu,
  );

  assert.equal(ownRowPredicates?.length, 2);
});

test("verification and transaction templates cover the required hosted controls", () => {
  assert.match(verification, /lesson_completion_rows/u);
  assert.match(verification, /module_completion_rows/u);
  assert.match(verification, /authenticated_lesson_insert/u);
  assert.match(verification, /authenticated_module_delete/u);
  assert.match(verification, /complete_lesson_rpc_absent/u);
  assert.match(verification, /pg_trigger/u);

  assert.match(rlsTemplate, /USER_A_UUID/gu);
  assert.match(rlsTemplate, /USER_B_UUID/gu);
  assert.match(
    rlsTemplate,
    /user_b_module_completion_blocked/u,
  );
  assert.match(
    rlsTemplate,
    /user_a_module_rows_after_lesson_delete/u,
  );
  assert.match(rlsTemplate, /rollback;/u);
});

test("Pass 1B source contains no credential material", () => {
  const combined = `${migration}\n${verification}\n${rlsTemplate}`;

  assert.doesNotMatch(
    combined,
    /sb_secret_|service_role|cfut_|BEGIN PRIVATE KEY/gu,
  );
});
