import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertPublicQuiz, SchemaValidationError } from "../content-engine/schema.ts";
import type { LessonCode, PublicQuiz } from "../content-engine/types.ts";

const LESSON_CODE_PATTERN = /^M0[1-8]_L0[1-5]$/u;
const cache = new Map<LessonCode, Promise<PublicQuiz>>();

export function parseQuizLessonCode(value: unknown): LessonCode {
  if (typeof value !== "string") {
    throw new SchemaValidationError("QuizLessonCode", ["lessonCode must be a string."]);
  }
  const normalized = value.trim().toUpperCase();
  if (!LESSON_CODE_PATTERN.test(normalized)) {
    throw new SchemaValidationError("QuizLessonCode", ["lessonCode must match M01_L01 through M08_L05."]);
  }
  return normalized as LessonCode;
}

async function readPublicQuiz(lessonCode: LessonCode): Promise<PublicQuiz> {
  const path = resolve(process.cwd(), "generated/public/quizzes", `${lessonCode}.json`);
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  assertPublicQuiz(parsed, `publicQuiz.${lessonCode}`);
  if (parsed.lessonCode !== lessonCode) {
    throw new SchemaValidationError("PublicQuiz", [`publicQuiz.${lessonCode}.lessonCode must equal its filename.`]);
  }
  return parsed;
}

export async function loadPublicQuiz(lessonCodeInput: unknown): Promise<Readonly<PublicQuiz>> {
  const lessonCode = parseQuizLessonCode(lessonCodeInput);
  let pending = cache.get(lessonCode);
  if (!pending) {
    pending = readPublicQuiz(lessonCode);
    cache.set(lessonCode, pending);
  }
  return pending;
}

/** Test-only cache reset. It remains inside the server-only module boundary. */
export function resetPublicQuizCacheForTests(): void {
  cache.clear();
}
