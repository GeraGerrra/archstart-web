import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260805030000_phase07_pass1c_quiz_attempt_foundation.sql",
  ),
  "utf8",
);

const verification = readFileSync(
  join(
    root,
    "supabase/verification/phase07-pass1c-quiz-attempt-foundation.sql",
  ),
  "utf8",
);

const rlsTemplate = readFileSync(
  join(
    root,
    "supabase/verification/phase07-pass1c-two-account-quiz-attempt-template.sql",
  ),
  "utf8",
);

test("Pass 1C requires the accepted Pass 1A and Pass 1B hosted foundations", () => {
  for (const relation of [
    "private.course_modules",
    "private.course_lessons",
    "private.course_projects",
    "public.lesson_activity",
    "public.lesson_completions",
    "public.module_completions",
  ]) {
    assert.match(migration, new RegExp(relation.replace(".", "\\."), "u"));
  }

  assert.match(
    migration,
    /Phase 07 Pass 1A and Pass 1B foundations are required/u,
  );
});

test("Quiz attempts are immutable, learner-owned, and aggregate-only", () => {
  assert.match(migration, /create table public\.quiz_attempts/u);
  assert.match(migration, /selected_answers jsonb not null/u);
  assert.match(migration, /score smallint not null/u);
  assert.match(migration, /question_count smallint not null default 5/u);
  assert.match(migration, /answer_key_sha256 text not null/u);
  assert.match(migration, /quiz attempts are immutable/u);

  for (const forbiddenColumn of [
    "correct_option_id",
    "correct_answer",
    "canonical_explanation",
  ]) {
    assert.doesNotMatch(
      migration,
      new RegExp(`^[^\\n]*${forbiddenColumn}[^\\n]*$`, "imu"),
    );
  }
});

test("answer payloads must contain exactly five string selections", () => {
  assert.match(migration, /private\.quiz_answers_shape_is_valid/u);
  assert.match(migration, /jsonb_object_length\(p_answers\) = 5/u);
  assert.match(migration, /jsonb_typeof\(option_value\) <> 'string'/u);
  assert.match(migration, /quiz_attempts_answers_shape/u);
});

test("browser roles receive own-row SELECT only", () => {
  assert.match(
    migration,
    /grant select on table public\.quiz_attempts\s+to authenticated/iu,
  );
  assert.match(migration, /quiz_attempts_select_own/u);
  assert.match(
    migration,
    /using \(\(select auth\.uid\(\)\) = user_id\)/u,
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(?:insert|update|delete|all)[^;]*public\.quiz_attempts/iu,
  );
});

test("Pass 1C does not add scoring, submission, completion activation, projects, or certificates", () => {
  for (const forbidden of [
    "create or replace function public.submit_quiz_attempt",
    "create or replace function public.complete_lesson",
    "create or replace function public.complete_module",
    "create table public.project_submissions",
    "create table public.certificates",
    "create table private.quiz_answer_keys",
  ]) {
    assert.doesNotMatch(migration, new RegExp(forbidden, "iu"));
  }
});

test("hosted verification covers grants, triggers, constraints, indexes, and zero initial rows", () => {
  assert.match(verification, /authenticated_insert/u);
  assert.match(verification, /authenticated_delete/u);
  assert.match(verification, /pg_trigger/u);
  assert.match(verification, /pg_constraint/u);
  assert.match(verification, /pg_indexes/u);
  assert.match(verification, /forbidden_quiz_attempt_columns/u);
  assert.match(verification, /quiz_attempt_rows/u);
});

test("two-account template covers isolation, shape rejection, immutability, and rollback", () => {
  assert.match(rlsTemplate, /USER_A_UUID/gu);
  assert.match(rlsTemplate, /USER_B_UUID/gu);
  assert.match(rlsTemplate, /malformed Quiz attempt was unexpectedly accepted/u);
  assert.match(rlsTemplate, /Quiz attempt update was unexpectedly accepted/u);
  assert.match(rlsTemplate, /user_a_attempts_visible/u);
  assert.match(rlsTemplate, /user_b_attempts_visible/u);
  assert.match(rlsTemplate, /rollback;/u);
});

test("Pass 1C source contains no credential material", () => {
  const combined = `${migration}\n${verification}\n${rlsTemplate}`;

  assert.doesNotMatch(
    combined,
    /sb_secret_|service_role|cfut_|BEGIN PRIVATE KEY|re_[A-Za-z0-9_-]{20,}/gu,
  );
});
