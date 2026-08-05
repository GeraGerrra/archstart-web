import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertServerQuizAnswerSet, SchemaValidationError } from "../content-engine/schema.ts";
import type { LessonCode, ServerQuizAnswerSet } from "../content-engine/types.ts";

interface ServerQuizAnswerKeyFile {
  schemaVersion: string;
  contentVersion: string;
  quizzes: Record<string, ServerQuizAnswerSet>;
}

interface LoadedServerQuizAnswerKeyFile {
  file: ServerQuizAnswerKeyFile;
  sha256: string;
}

export interface QuizAnswerAuthority {
  answerSet: Readonly<ServerQuizAnswerSet>;
  answerKeySha256: string;
  contentVersion: string;
  schemaVersion: string;
}

let cached: Promise<LoadedServerQuizAnswerKeyFile> | null = null;

function assertAnswerKeyFile(value: unknown): asserts value is ServerQuizAnswerKeyFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SchemaValidationError("ServerQuizAnswerKeyFile", ["answerKeyFile must be an object."]);
  }
  const record = value as Record<string, unknown>;
  const issues: string[] = [];
  if (typeof record.schemaVersion !== "string" || !record.schemaVersion) issues.push("answerKeyFile.schemaVersion must be a non-empty string.");
  if (typeof record.contentVersion !== "string" || !record.contentVersion) issues.push("answerKeyFile.contentVersion must be a non-empty string.");
  if (!record.quizzes || typeof record.quizzes !== "object" || Array.isArray(record.quizzes)) {
    issues.push("answerKeyFile.quizzes must be an object keyed by lesson code.");
  } else {
    for (const [lessonCode, answerSet] of Object.entries(record.quizzes)) {
      try {
        assertServerQuizAnswerSet(answerSet, `answerKeyFile.quizzes.${lessonCode}`);
        if (answerSet.lessonCode !== lessonCode) {
          issues.push(`answerKeyFile.quizzes.${lessonCode}.lessonCode must equal its map key.`);
        }
      } catch (error) {
        if (error instanceof SchemaValidationError) issues.push(...error.issues);
        else throw error;
      }
    }
  }
  if (issues.length) throw new SchemaValidationError("ServerQuizAnswerKeyFile", issues);
}

async function readAnswerKeyFile(): Promise<LoadedServerQuizAnswerKeyFile> {
  const path = resolve(process.cwd(), "generated/server/quiz-answer-keys.json");
  const raw = await readFile(path);
  const parsed: unknown = JSON.parse(raw.toString("utf8"));
  assertAnswerKeyFile(parsed);
  return {
    file: parsed,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

async function loadedAnswerKeyFile(): Promise<LoadedServerQuizAnswerKeyFile> {
  cached ??= readAnswerKeyFile();
  return cached;
}

/**
 * Server-only scoring boundary. This module imports the `server-only` sentinel
 * and must never be re-exported from a client-safe module.
 */
export async function loadQuizAnswerSet(lessonCode: LessonCode): Promise<Readonly<ServerQuizAnswerSet>> {
  const loaded = await loadedAnswerKeyFile();
  const answerSet = loaded.file.quizzes[lessonCode];
  if (!answerSet) throw new Error(`No server-only quiz answer set exists for ${lessonCode}.`);
  return answerSet;
}

export async function loadQuizAnswerAuthority(lessonCode: LessonCode): Promise<Readonly<QuizAnswerAuthority>> {
  const loaded = await loadedAnswerKeyFile();
  const answerSet = loaded.file.quizzes[lessonCode];
  if (!answerSet) throw new Error(`No server-only quiz answer set exists for ${lessonCode}.`);
  return {
    answerSet,
    answerKeySha256: loaded.sha256,
    contentVersion: loaded.file.contentVersion,
    schemaVersion: loaded.file.schemaVersion,
  };
}

/** Test-only cache reset. It remains inside the server-only module boundary. */
export function resetQuizAnswerKeyCacheForTests(): void {
  cached = null;
}
