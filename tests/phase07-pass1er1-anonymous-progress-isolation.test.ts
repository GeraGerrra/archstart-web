import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");

const selectedA = read("src/prototypes/selected-a/SelectedAPrototype.tsx");
const shell = read("src/prototypes/selected-a/shell-adapter.tsx");
const data = read("src/prototypes/selected-a/data.ts");
const dashboardRoute = read("app/prototype/a/dashboard/page.tsx");
const repairDoc = read("PHASE07_ANONYMOUS_PROGRESS_ISOLATION_REPAIR.md");


test("anonymous shell projection is exact zero state", () => {
  assert.match(shell, /export const ANONYMOUS_SHELL_PROGRESS_PROJECTION/u);
  for (const field of [
    "completedLessonCodes: []",
    "completedModuleCodes: []",
    "activeLessonCodes: []",
    'currentModuleCode: "M01"',
  ]) {
    assert.match(shell, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.match(shell, /progressProjection \?\? ANONYMOUS_SHELL_PROGRESS_PROJECTION/u);
  assert.doesNotMatch(shell, /const demoState = progress\[module\.code\]/u);
  assert.doesNotMatch(shell, /: demoState\.done|: demoState\.status/u);
});


test("public Course Overview derives exact zero from the anonymous shared projection", () => {
  assert.match(selectedA, /selectedACourseModelForProjection/u);
  assert.match(selectedA, /projection\.completedLessonCodes\.length/u);
  assert.match(selectedA, /projection\.completedModuleCodes\.length/u);
  assert.match(selectedA, /acceptedProjects/u);
  assert.match(selectedA, /label: projection\.authenticated \? "Продолжить обучение" : "Начать обучение"/u);
  assert.match(selectedA, /Без аккаунта показано нулевое стартовое состояние/u);
  assert.match(selectedA, /ANONYMOUS_COURSE_PROGRESS_PROJECTION/u);
});

test("Phase 02 demo fixture remains data-only and cannot drive any production shell fallback", () => {
  assert.match(data, /export const progress:/u);
  assert.match(data, /M01:\{status:"in-progress",done:2/u);
  assert.match(data, /M04:\{status:"complete",done:5/u);
  assert.doesNotMatch(shell, /progress,/u);
  assert.doesNotMatch(selectedA.slice(0, selectedA.indexOf("const selectedADashboardModel")), /progress\[module\.code\]/u);
  assert.doesNotMatch(shell, /lesson\.moduleCode === "M04"/u);
});


test("authenticated Dashboard still passes its real projection", () => {
  assert.match(dashboardRoute, /progressProjection=\{projection\.shellProgress\}/u);
  assert.match(dashboardRoute, /loadDashboardProjection\(profile\.first_name\)/u);
  assert.match(dashboardRoute, /requireOnboardedProfile/u);
});


test("repair is source-only and preserves deferred authorities", () => {
  assert.match(repairDoc, /source-only/iu);
  for (const boundary of [
    "database",
    "migration",
    "Auth",
    "completion",
    "Quiz",
    "project workflow",
    "Storage",
    "dependency",
    "environment",
  ]) {
    assert.match(repairDoc, new RegExp(boundary, "iu"));
  }
});
