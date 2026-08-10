import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  ANONYMOUS_COURSE_PROGRESS_PROJECTION,
  buildCourseProgressProjection,
  courseLessonVisualStatus,
  courseModuleVisualStatus,
  courseProjectStatusMap,
} from "../src/progress/course-progress.ts";
import { formatProjectFileSize } from "../src/project-workspace/format.ts";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");

const shell = read("src/prototypes/selected-a/shell-adapter.tsx");
const selectedA = read("src/prototypes/selected-a/SelectedAPrototype.tsx");
const lessonAdapter = read("src/prototypes/selected-a/lesson-adapter.ts");
const progressLoader = read("src/server/course-progress-projection.ts");
const dashboardProjection = read("src/server/dashboard-projection.ts");
const projectWorkspace = read("src/learning/project/ProjectWorkspace.tsx");
const completionAdapter = read("src/prototypes/selected-a/completion-adapter.ts");
const header = read("src/app-shell/Header.tsx");
const appShell = read("src/app-shell/AppShell.tsx");
const globals = read("app/globals.css");
const phaseDoc = read("PHASE07_PROGRESS_TRUTH_REPAIR.md");

const productionRoutes = [
  "app/prototype/a/home/page.tsx",
  "app/prototype/a/course/page.tsx",
  "app/prototype/a/course/[moduleCode]/page.tsx",
  "app/prototype/a/course/[moduleCode]/[lessonCode]/[item]/page.tsx",
  "app/prototype/a/course/[moduleCode]/project/page.tsx",
  "app/prototype/a/review/page.tsx",
].map(read);

const completedM01AndM08 = [
  ...Array.from({ length: 5 }, (_, index) => `M01_L0${index + 1}`),
  ...Array.from({ length: 5 }, (_, index) => `M08_L0${index + 1}`),
];

const mixedProjection = buildCourseProgressProjection({
  authenticated: true,
  completedLessonCodes: completedM01AndM08,
  activeLessonCodes: [],
  moduleCompletionRowCodes: ["M01", "M08"],
  projectSubmissions: [
    { project_code: "M01_P01", current_status: "accepted" },
    { project_code: "M08_P08", current_status: "draft" },
  ],
});

test("mixed learner state separates lesson completion, project state and full module completion", () => {
  assert.equal(mixedProjection.completedLessonCodes.length, 10);
  assert.deepEqual(mixedProjection.moduleCompletionRowCodes, ["M01", "M08"]);
  assert.deepEqual(mixedProjection.lessonCompleteModuleCodes, ["M01", "M08"]);
  assert.deepEqual(mixedProjection.completedModuleCodes, ["M01"]);
  assert.equal(mixedProjection.continueLessonCode, "M02_L01");
  assert.equal(mixedProjection.currentModuleCode, "M02");

  const projects = courseProjectStatusMap(mixedProjection);
  assert.equal(projects.get("M01_P01"), "accepted");
  assert.equal(projects.get("M08_P08"), "draft");
  assert.equal(projects.get("M04_P04"), "none");

  assert.equal(courseModuleVisualStatus("M01", mixedProjection, "M01_P01"), "complete");
  assert.equal(courseModuleVisualStatus("M08", mixedProjection, "M08_P08"), "in-progress");
  assert.equal(courseModuleVisualStatus("M04", mixedProjection, "M04_P04"), "available");
  assert.equal(courseLessonVisualStatus("M01_L01", mixedProjection), "complete");
  assert.equal(courseLessonVisualStatus("M04_L03", mixedProjection), "available");
});

test("anonymous course projection is exact zero and contains no legacy M01 or M04 fixture", () => {
  assert.equal(ANONYMOUS_COURSE_PROGRESS_PROJECTION.authenticated, false);
  assert.deepEqual(ANONYMOUS_COURSE_PROGRESS_PROJECTION.completedLessonCodes, []);
  assert.deepEqual(ANONYMOUS_COURSE_PROGRESS_PROJECTION.activeLessonCodes, []);
  assert.deepEqual(ANONYMOUS_COURSE_PROGRESS_PROJECTION.completedModuleCodes, []);
  assert.ok(ANONYMOUS_COURSE_PROGRESS_PROJECTION.projectStatuses.every(
    (entry) => entry.status === "none",
  ));
  assert.equal(
    courseLessonVisualStatus("M01_L01", ANONYMOUS_COURSE_PROGRESS_PROJECTION),
    "available",
  );
  assert.equal(
    courseLessonVisualStatus("M04_L03", ANONYMOUS_COURSE_PROGRESS_PROJECTION),
    "available",
  );
  assert.doesNotMatch(shell, /M01_L01[\s\S]*?"complete"/u);
  assert.doesNotMatch(shell, /lesson\.moduleCode === "M04"/u);
  assert.doesNotMatch(lessonAdapter, /M01_L01[\s\S]*?"complete"/u);
});

test("all production Selected-A routes load and pass the shared optional account projection", () => {
  for (const route of productionRoutes) {
    assert.match(route, /loadCourseProgressProjection/u);
    assert.match(route, /progressProjection=\{progressProjection\}/u);
    assert.match(route, /force-dynamic/u);
  }
  assert.match(progressLoader, /await client\.auth\.getClaims\(\)/u);
  const claimsPosition = progressLoader.indexOf("await client.auth.getClaims()");
  const firstReadPosition = progressLoader.indexOf('.from("lesson_activity")');
  assert.ok(claimsPosition >= 0 && firstReadPosition > claimsPosition);
  assert.match(progressLoader, /if \(claimsError \|\| !userId\) return ANONYMOUS_COURSE_PROGRESS_PROJECTION/u);
  assert.doesNotMatch(progressLoader, /createSecretSupabaseClient|SUPABASE_SECRET_KEY|sb_secret_/u);
  assert.doesNotMatch(progressLoader, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/u);
});

test("shared header exposes lesson-only progress to authenticated users and stays clean anonymously", () => {
  assert.match(shell, /headerProgress=\{progressProjection\?\.authenticated/u);
  assert.match(shell, /completedLessonCodes\.length\} \/ 40/u);
  assert.match(header, /asa-header__progress/u);
  assert.match(header, /aria-label=\{progress\.ariaLabel\}/u);
  assert.match(appShell, /progress=\{headerProgress\}/u);
  assert.match(globals, /\.asa-header__progress/u);
  assert.match(shell, /authenticated: false/u);
});

test("course, module, lesson and dashboard adapters use the same project-aware truth", () => {
  assert.match(selectedA, /selectedACourseModelForProjection/u);
  assert.match(selectedA, /completedModules: projection\.completedModuleCodes\.length/u);
  assert.match(selectedA, /completedProjects: acceptedProjects/u);
  assert.match(selectedA, /COURSE_PROJECT_STATUS_LABELS\[projectStatus\]/u);
  assert.match(read("src/learning/course/CourseModuleCard.tsx"), /label=\{module\.project\.statusLabel\}(?![^>]*compact)/u);
  assert.match(read("src/app-shell/ModuleMenuPanel.tsx"), /label=\{module\.project\.statusLabel\}(?![^>]*compact)/u);
  assert.match(lessonAdapter, /statusForLesson\([\s\S]*?progressProjection/u);
  assert.match(dashboardProjection, /buildCourseProgressProjection/u);
  assert.match(dashboardProjection, /completedModuleCodes = new Set\(sharedProgress\.completedModuleCodes\)/u);
  assert.doesNotMatch(selectedA.slice(0, selectedA.indexOf("const selectedADashboardModel")), /progress\[module\.code\]/u);
});

test("project readiness and file-size copy are truthful for M08 and small PNG files", () => {
  assert.equal(formatProjectFileSize(47_557), "46,4 KiB");
  assert.equal(formatProjectFileSize(7_666_804), "7,3 MiB");
  assert.match(projectWorkspace, /formatProjectFileSize\(projection\.activeFile\.sizeBytes\)/u);
  assert.match(projectWorkspace, /requiresSupportingText[\s\S]*?сохранённый текст M02[\s\S]*?: "Финальное решение принимает база данных: нужны 5 уроков и принятый файл\."/u);
  const readinessCopy = projectWorkspace.slice(
    projectWorkspace.indexOf("<div className=\"asa-project-workspace__submit\">") ,
    projectWorkspace.indexOf("{immutable ?"),
  );
  assert.doesNotMatch(readinessCopy, /M08_P08/u);
});

test("database module completion remains lesson-only while product completion stays project-aware", () => {
  assert.match(completionAdapter, /Завершение уроков модуля/u);
  assert.match(completionAdapter, /Статус проекта учитывается отдельно/u);
  assert.match(completionAdapter, /Модуль станет полностью завершённым после принятия проекта/u);
  assert.match(phaseDoc, /module_completions.*lesson-only/isu);
  assert.match(phaseDoc, /five lessons are complete[\s\S]*?accepted/iu);
});

test("repair is source-only and does not widen project, database or Phase 08 scope", () => {
  assert.equal(
    readdirSync(join(root, "supabase/migrations")).filter((name) => /pass2e/iu.test(name)).length,
    0,
  );
  assert.match(phaseDoc, /No Supabase migration/iu);
  assert.match(phaseDoc, /No .*dependency change/isu);
  assert.match(phaseDoc, /No .*Phase 08 source/isu);
});
