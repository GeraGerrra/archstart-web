import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");

const migration = read(
  "supabase/migrations/20260805050000_phase07_pass1d2_completion_activation.sql",
);
const verification = read(
  "supabase/verification/phase07-pass1d2-completion-activation.sql",
);
const twoAccount = read(
  "supabase/verification/phase07-pass1d2-two-account-completion-activation-template.sql",
);
const stateLoader = read("src/server/completion-state.ts");
const actions = read("src/server/completion-actions.ts");
const completionTypes = read("src/completion/types.ts");
const completionButton = read("src/completion/CutoutCompletionButton.tsx");
const quizShell = read("src/quiz/QuizShell.tsx");
const selectedA = read("src/prototypes/selected-a/SelectedAPrototype.tsx");
const lessonRoute = read("app/prototype/a/course/[moduleCode]/[lessonCode]/[item]/page.tsx");
const moduleRoute = read("app/prototype/a/course/[moduleCode]/page.tsx");
const quizBoundary = read("scripts/quiz/check-boundaries.mjs");
const completionBoundary = read("scripts/completion/check-boundaries.mjs");

test("database lesson completion requires any persisted Quiz attempt and no score threshold", () => {
  assert.match(migration, /from public\.quiz_attempts as attempt/u);
  assert.match(migration, /attempt\.user_id = new\.user_id/u);
  assert.match(migration, /attempt\.lesson_code = new\.lesson_code/u);
  assert.match(migration, /lesson completion requires a persisted Quiz attempt/u);
  assert.doesNotMatch(migration, /attempt\.score|score\s*(?:>=|>|=)\s*[1-5]/u);
});

test("service role receives narrow completion writes while browser roles remain read-only", () => {
  assert.match(
    migration,
    /grant select, insert, delete on table[\s\S]*public\.lesson_completions,[\s\S]*public\.module_completions[\s\S]*to service_role/iu,
  );
  assert.match(
    migration,
    /revoke insert, update, delete on table[\s\S]*from anon, authenticated/iu,
  );
  assert.doesNotMatch(migration, /create or replace function public\.(?:complete|undo)_/iu);
});

test("server state reads use the learner session and own-row RLS", () => {
  assert.match(stateLoader, /createServerSupabaseClient/u);
  assert.match(stateLoader, /auth\.getClaims/u);
  assert.match(stateLoader, /from\("quiz_attempts"\)/u);
  assert.match(stateLoader, /from\("lesson_completions"\)/u);
  assert.match(stateLoader, /from\("module_completions"\)/u);
  assert.doesNotMatch(stateLoader, /createSecretSupabaseClient|SUPABASE_SECRET_KEY/u);
  assert.doesNotMatch(stateLoader, /\.score/u);
});

test("four completion Server Actions authenticate before elevated writes", () => {
  for (const name of [
    "completeLessonCompletionAction",
    "undoLessonCompletionAction",
    "completeModuleCompletionAction",
    "undoModuleCompletionAction",
  ]) {
    assert.match(actions, new RegExp(`export async function ${name}`, "u"));
  }

  const claimsPosition = actions.indexOf("await client.auth.getClaims()");
  const secretPosition = actions.indexOf("createSecretSupabaseClient()");
  assert.ok(claimsPosition >= 0);
  assert.ok(secretPosition > claimsPosition);
  assert.match(actions, /user_id: auth\.userId/u);
  assert.doesNotMatch(actions, /input\.(?:userId|score|answerKeySha256)/u);
});

test("persistent completion control preserves the local demo fallback", () => {
  assert.match(completionTypes, /CompletionMutationAction/u);
  assert.match(completionButton, /completeAction/u);
  assert.match(completionButton, /undoAction/u);
  assert.match(completionButton, /if \(!completeAction\)/u);
  assert.match(completionButton, /if \(!undoAction\)/u);
  assert.match(completionButton, /router\.refresh\(\)/u);
  assert.match(completionButton, /data-completion-state/u);
  assert.doesNotMatch(completionButton, /\buseEffect\b/u);
  assert.match(
    selectedA,
    /key=\{`\$\{courseModule\.code\}:\$\{completionState\}`\}/u,
  );
  assert.match(
    selectedA,
    /key=\{`\$\{lesson\.code\}:\$\{completionState\}`\}/u,
  );
});

test("Quiz success refreshes server-owned completion readiness", () => {
  assert.match(quizShell, /useRouter/u);
  assert.match(
    quizShell,
    /if \(result\.status === "success"\) router\.refresh\(\)/u,
  );
});

test("framework refresh dependencies are explicit in Quiz and Completion boundaries", () => {
  assert.match(
    quizBoundary,
    /new Set\(\["react", "next\/navigation", "@\/src\/design-system"\]\)/u,
  );

  assert.match(
    completionBoundary,
    /new Set\(\["react", "next\/image", "next\/navigation", "@\/src\/design-system"\]\)/u,
  );
});

test("production routes use persistent state while development keeps explicit QA fixtures", () => {
  assert.match(lessonRoute, /loadLessonCompletionSnapshot/u);
  assert.match(lessonRoute, /process\.env\.NODE_ENV === "development"/u);
  assert.match(lessonRoute, /lesson-ready/u);
  assert.match(lessonRoute, /lesson-complete/u);
  assert.match(lessonRoute, /completeLessonCompletionAction\.bind/u);
  assert.match(lessonRoute, /undoLessonCompletionAction\.bind/u);

  assert.match(moduleRoute, /loadModuleCompletionSnapshot/u);
  assert.match(moduleRoute, /process\.env\.NODE_ENV === "development"/u);
  assert.match(moduleRoute, /module-ready/u);
  assert.match(moduleRoute, /module-complete/u);
  assert.match(moduleRoute, /completedLessonCodes/u);
  assert.match(moduleRoute, /completeModuleCompletionAction\.bind/u);
  assert.match(moduleRoute, /undoModuleCompletionAction\.bind/u);

  assert.match(selectedA, /completeCompletionAction/u);
  assert.match(selectedA, /undoCompletionAction/u);
});

test("completion client source receives no answer authority or server secret", () => {
  for (const source of [completionTypes, completionButton, quizShell, selectedA]) {
    assert.doesNotMatch(
      source,
      /correctOptionId|correctAnswer|canonicalExplanation|quiz-answer-keys|SUPABASE_SECRET_KEY|sb_secret_/u,
    );
  }
});

test("hosted verification covers prerequisites, grants, RLS, two accounts, and rollback", () => {
  assert.match(verification, /lesson_prerequisite_reads_quiz_attempts/u);
  assert.match(verification, /no_minimum_score_threshold/u);
  assert.match(verification, /authenticated_lesson_insert/u);
  assert.match(verification, /public_complete_lesson_rpc_absent/u);

  assert.match(twoAccount, /USER_A_UUID/gu);
  assert.match(twoAccount, /USER_B_UUID/gu);
  assert.match(twoAccount, /lesson_without_attempt_blocked/u);
  assert.match(twoAccount, /user_b_module_completion_blocked/u);
  assert.match(twoAccount, /user_a_quiz_attempts_after_lesson_delete/u);
  assert.match(twoAccount, /rollback;/u);
});
