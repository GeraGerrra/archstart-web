
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { classifyFileName } from "../src/content-engine/source-policy.ts";
import { containsForbiddenProductionContent } from "../src/content-engine/mnot.ts";
import { findForbiddenQuizKeys } from "../src/content-engine/quiz-boundary.ts";
import { findForbiddenPublicPaths } from "../src/content-engine/paths.ts";

const json = async (path: string) => JSON.parse(await readFile(path, "utf8"));

test("official counts and question cardinality", async () => {
  const index = await json("generated/public/course-index.json");
  assert.equal(index.course.moduleCount, 8); assert.equal(index.modules.length, 8);
  assert.equal(index.course.lessonCount, 40); assert.equal(index.lessons.length, 40);
  assert.equal(index.course.projectCount, 8); assert.equal(index.projects.length, 8);
  assert.equal(index.course.quizQuestionCount, 200);
  for (const lesson of index.lessons) {
    const quiz = await json(`generated/public/quizzes/${lesson.code}.json`);
    assert.equal(quiz.questions.length, 5, lesson.code);
  }
});

test("official order comes from Course Structure", async () => {
  const index = await json("generated/public/course-index.json");
  assert.deepEqual(index.modules.map((x: {code:string}) => x.code), ["M01","M02","M03","M04","M05","M06","M07","M08"]);
  assert.deepEqual(index.lessons.slice(0,5).map((x:{code:string})=>x.code), ["M01_L01","M01_L02","M01_L03","M01_L04","M01_L05"]);
});

test("clean allowlist and default deny", () => {
  assert.equal(classifyFileName("M01_L01_PRES.pptx").status, "AVAILABLE");
  assert.equal(classifyFileName("M01_L01_INFO.docx").status, "IGNORED_BY_POLICY");
  assert.equal(classifyFileName("ARCH.START_M01_Project01_Internal_Package.docx").status, "IGNORED_BY_POLICY");
  assert.equal(classifyFileName("M01_P01_OEXA.pdf").status, "IGNORED_BY_POLICY");
  assert.equal(classifyFileName("lesson.mp4").status, "IGNORED_BY_POLICY");
  assert.equal(classifyFileName("unknown.docx").status, "IGNORED_BY_POLICY");
  assert.equal(classifyFileName("m01full.pdf").status, "IGNORED_BY_POLICY");
});

test("PICE absence stays explicit and combined PDF cannot replace it", async () => {
  const pending = await json("generated/reports/pending-assets.json");
  assert.equal(classifyFileName("m01full.pdf").status, "IGNORED_BY_POLICY");
  const m01 = await json("generated/public/m01-dataset.json");
  assert.ok(m01.lessons.every((x:{assets:{PICE:{status:string}}})=>x.assets.PICE.status === "AVAILABLE"));
  assert.ok(pending.items.some((x:{contentCode:string;role:string;status:string})=>x.contentCode==="M02_L01" && x.role==="PICE" && x.status==="PENDING_NOT_SUPPLIED_IN_THIS_PHASE"));
});

test("MNOT prompt is excluded", async () => {
  const m01 = await json("generated/public/m01-dataset.json");
  assert.ok(m01.lessons.every((lesson: {miniOutput:unknown}) => !containsForbiddenProductionContent(lesson.miniOutput)));
  const report = await json("generated/reports/mnot-exclusion-report.json");
  assert.equal(report.result, "PASS");
});

test("SRPT sections are stable and ordered", async () => {
  const m01 = await json("generated/public/m01-dataset.json");
  for (const lesson of m01.lessons) {
    assert.equal(lesson.transcript.sections[0].id, "S01");
    assert.deepEqual(lesson.transcript.sections.map((x:{order:number})=>x.order), lesson.transcript.sections.map((_:unknown,i:number)=>i+1));
  }
});

test("vocabulary provenance is retained", async () => {
  const m01 = await json("generated/public/m01-dataset.json");
  const entries = m01.lessons.flatMap((x:{vocabularyEntries:unknown[]})=>x.vocabularyEntries);
  assert.equal(entries.length, 69);
  assert.ok(entries.every((x:{sourcePage:number})=>Number.isInteger(x.sourcePage) && x.sourcePage > 0));
});

test("public quiz files contain no answer data", async () => {
  const files = await readdir("generated/public/quizzes");
  for (const file of files) assert.deepEqual(findForbiddenQuizKeys(await json(`generated/public/quizzes/${file}`)), [], file);
  const report = await json("generated/reports/quiz-security-report.json");
  assert.equal(report.result, "PASS");
});

test("M03 aliases resolve exactly without fuzzy matching", async () => {
  const aliases = await json("generated/reports/alias-resolution.json");
  const m03 = aliases.items.filter((x:{canonicalCode:string})=>x.canonicalCode === "M03_P03");
  assert.equal(m03.length, 2); assert.ok(m03.every((x:{status:string;fuzzyMatchingUsed:boolean})=>x.status==="ALIAS_RESOLVED" && x.fuzzyMatchingUsed===false));
});

test("M08 remains MULTI_PAGE_PACK", async () => {
  const index = await json("generated/public/course-index.json");
  assert.equal(index.projects.find((x:{code:string})=>x.code==="M08_P08").formatType, "MULTI_PAGE_PACK");
});

test("no English duplicate lesson tree or invented content", async () => {
  const routes = await json("generated/public/route-language-map.json");
  assert.ok(!routes.documentary.patterns.some((x:string)=>x.includes("lesson")));
  for (const section of ["overview","process","research","methodology","team","impact","journal"]) {
    const readme = await readFile(`content/en/${section}/README.md`, "utf8");
    assert.match(readme, /No publishable body copy is present/);
  }
});

test("public generated records have no local path leakage", async () => {
  for (const path of ["generated/public/content-manifest.json","generated/public/course-index.json","generated/public/route-language-map.json","generated/public/m01-dataset.json"]) {
    assert.deepEqual(findForbiddenPublicPaths(await json(path)), [], path);
  }
});
