import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertContentManifest, assertLessonRecord, assertProjectRecord, SchemaValidationError } from "../src/content-engine/schema.ts";

const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));

test("runtime schema rejects a malformed lesson record with an actionable path", async () => {
  const dataset = await json("generated/public/m01-dataset.json") as { lessons: Array<Record<string, unknown>> };
  const malformed = structuredClone(dataset.lessons[0]!);
  malformed.code = "LESSON_ONE";
  delete malformed.objective;
  assert.throws(
    () => assertLessonRecord(malformed, "lessonFixture"),
    (error: unknown) => error instanceof SchemaValidationError && error.message.includes("lessonFixture.code") && error.message.includes("lessonFixture.objective"),
  );
});

test("runtime schema rejects a malformed project and protects M08 format", async () => {
  const dataset = await json("generated/public/m01-dataset.json") as { project: Record<string, unknown> };
  const malformed = structuredClone(dataset.project);
  malformed.code = "M08_P08";
  malformed.moduleCode = "M08";
  malformed.formatType = "SINGLE_BOARD";
  assert.throws(
    () => assertProjectRecord(malformed, "projectFixture"),
    (error: unknown) => error instanceof SchemaValidationError && error.message.includes("MULTI_PAGE_PACK"),
  );
});


test("runtime schema rejects malformed manifest counts and non-allowlisted public assets", async () => {
  const manifest = await json("generated/public/content-manifest.json") as Record<string, unknown>;
  const malformed = structuredClone(manifest) as { counts: Record<string, unknown>; assetRegistry: Array<Record<string, unknown>> };
  malformed.counts.lessons = 39;
  malformed.assetRegistry[0]!.classification = "UNKNOWN";
  assert.throws(
    () => assertContentManifest(malformed, "manifestFixture"),
    (error: unknown) => error instanceof SchemaValidationError
      && error.message.includes("manifestFixture.counts.lessons")
      && error.message.includes("manifestFixture.assetRegistry[0].classification"),
  );
});
