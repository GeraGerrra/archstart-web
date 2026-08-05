import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");

const dashboardRoute = read("app/prototype/a/dashboard/page.tsx");
const lessonRoute = read("app/prototype/a/course/[moduleCode]/[lessonCode]/[item]/page.tsx");
const activityRecorder = read("app/prototype/a/course/[moduleCode]/[lessonCode]/[item]/LessonActivityRecorder.tsx");
const projection = read("src/server/dashboard-projection.ts");
const dashboardPage = read("src/learning/dashboard/DashboardPage.tsx");
const learningTypes = read("src/learning/types.ts");
const selectedA = read("src/prototypes/selected-a/SelectedAPrototype.tsx");
const shellAdapter = read("src/prototypes/selected-a/shell-adapter.tsx");
const routeList = read("ROUTE_LIST.md");
const phaseDoc = read("PHASE07_DASHBOARD_PROGRESS_PROJECTION.md");


test("My Course remains onboarding-gated and renders the real selected-A Dashboard", () => {
  assert.match(dashboardRoute, /requireOnboardedProfile\("\/prototype\/a\/dashboard"\)/u);
  assert.match(dashboardRoute, /loadDashboardProjection\(profile\.first_name\)/u);
  assert.match(dashboardRoute, /<SelectedADashboard/u);
  assert.match(dashboardRoute, /model=\{projection\.model\}/u);
  assert.match(dashboardRoute, /progressProjection=\{projection\.shellProgress\}/u);
  assert.doesNotMatch(dashboardRoute, /AccountDashboard/u);
});


test("Dashboard reads authenticate first and remain own-row session reads", () => {
  assert.match(projection, /import "server-only"/u);
  assert.match(projection, /createServerSupabaseClient/u);
  const claimsPosition = projection.indexOf("await client.auth.getClaims()");
  const activityPosition = projection.indexOf('.from("lesson_activity")');
  assert.ok(claimsPosition >= 0);
  assert.ok(activityPosition > claimsPosition);
  assert.match(projection, /\.eq\("user_id", userId\)/u);
  assert.doesNotMatch(
    projection,
    /createSecretSupabaseClient|SUPABASE_SECRET_KEY|sb_secret_/u,
  );
});


test("Dashboard projection reads all accepted learner authorities without writing", () => {
  for (const table of [
    "lesson_activity",
    "quiz_attempts",
    "lesson_completions",
    "module_completions",
  ]) {
    assert.match(projection, new RegExp(`\\.from\\("${table}"\\)`, "u"));
  }
  assert.doesNotMatch(projection, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/u);
});


test("Quiz attempts support history but completion counts come only from explicit rows", () => {
  assert.match(projection, /completedLessonCodes = new Set\(lessonCompletions/u);
  assert.match(projection, /completedModuleCodes = new Set\(moduleCompletions/u);
  assert.match(projection, /latestAttempt\.score/u);
  assert.match(projection, /completedLessons: completedLessonCodes\.size/u);
  assert.doesNotMatch(projection, /completedLessons:\s*.*latestAttempt/u);
});


test("Continue Learning follows accepted deterministic precedence", () => {
  assert.match(
    projection,
    /latestActivity && !completedLessonCodes\.has\(latestActivity\.lesson_code\)/u,
  );
  assert.match(projection, /nextIncompleteLessonCode/u);
  assert.match(
    projection,
    /latestAttempt && !completedLessonCodes\.has\(latestAttempt\.lesson_code\)/u,
  );
  assert.match(
    projection,
    /orderedLessonCodes\.find\([\s\S]*!completedLessonCodes\.has\(code\)/u,
  );
  assert.match(projection, /titleRu: "Все уроки завершены"/u);
});


test("empty history and real activity remain truthful and answer-safe", () => {
  assert.match(projection, /title: "Истории пока нет"/u);
  assert.match(projection, /title: "Последняя активность"/u);
  assert.match(projection, /value: latestAttempt[\s\S]*latestAttempt\.score/u);
  assert.doesNotMatch(
    projection,
    /selected_answers|correctOptionId|correctAnswer|canonicalExplanation|quiz-answer-keys/u,
  );
});


test("canonical lesson visits use the accepted browser RPC and never choose identity", () => {
  assert.match(activityRecorder, /createBrowserSupabaseClient/u);
  assert.match(activityRecorder, /client\.auth\.getSession\(\)/u);
  assert.match(activityRecorder, /client\.rpc\("record_lesson_activity"/u);
  assert.match(activityRecorder, /p_lesson_code: normalizedLessonCode/u);
  assert.match(activityRecorder, /p_last_item: item/u);
  assert.doesNotMatch(activityRecorder, /user_id|SUPABASE_SECRET_KEY|createSecretSupabaseClient/u);
  assert.match(activityRecorder, /"lecture-materials"/u);
  assert.doesNotMatch(activityRecorder, /"resources",/u);
});


test("lesson route mounts the invisible activity recorder before the accepted surface", () => {
  assert.match(lessonRoute, /import \{ LessonActivityRecorder \}/u);
  assert.match(
    lessonRoute,
    /<LessonActivityRecorder lessonCode=\{lesson\.code\} item=\{item\} \/>/u,
  );
  assert.match(lessonRoute, /<SelectedALesson/u);
});


test("signed-in Dashboard shell uses real progress while static demo fallback remains", () => {
  assert.match(shellAdapter, /SelectedAShellProgressProjection/u);
  assert.match(shellAdapter, /completedLessonCodes/u);
  assert.match(shellAdapter, /completedModuleCodes/u);
  assert.match(shellAdapter, /activeLessonCodes/u);
  assert.match(shellAdapter, /selectedAModulesForProjection\(progressProjection\)/u);
  assert.match(selectedA, /model = selectedADashboardModel/u);
  assert.match(selectedA, /progressProjection\?: SelectedAShellProgressProjection/u);
  assert.match(selectedA, /currentModule=\{progressProjection\?\.currentModuleCode \?\? "M01"\}/u);
});


test("Dashboard keeps selected-A layout, optional profile access, and official module order", () => {
  assert.match(learningTypes, /profileAction\?: LearningLink/u);
  assert.match(dashboardPage, /model\.profileAction/u);
  assert.match(dashboardPage, /className="asa-text-link"/u);
  assert.match(projection, /courseModules\.map\(\(module\)/u);
  assert.match(projection, /profileAction: \{ label: "Профиль и выход", href: "\/profile" \}/u);
});


test("Pass 1E is source-only and documents the exact deferred boundary", () => {
  assert.match(routeList, /PHASE 07\.1E SIGNED-IN DASHBOARD AND PROGRESS PROJECTION/u);
  assert.match(phaseDoc, /No Supabase migration is required/u);
  assert.match(phaseDoc, /public Course Overview remains unchanged/u);
  assert.match(phaseDoc, /no Supabase migration|No Supabase migration/iu);
  for (const deferred of [
    "certificate",
    "project submission",
    "reviewer",
  ]) {
    assert.match(phaseDoc, new RegExp(deferred, "iu"));
  }
});
