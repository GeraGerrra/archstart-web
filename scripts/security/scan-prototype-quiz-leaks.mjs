#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_ROOTS = ["app/prototypes", "app/prototype", "app/prototype-review", "src/prototypes"];
const REVIEW_ROOTS = ["delivery/phase-02/static-review", "delivery/phase-02-selected-a-ia-v2/static-review"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".html", ".json"]);
const SERVER_BOUNDARY_PATTERNS = [
  { name: "generated/server", pattern: /generated\/server/iu },
  { name: "quiz answer loader", pattern: /quiz-answer-key-loader|loadQuizAnswerSet/iu },
  { name: "server answer field", pattern: /\b(?:correctOptionId|correctAnswer|answerKey)\b/u },
];

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listTextFiles(root) {
  const output = [];
  if (!(await exists(root))) return output;
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) output.push(path);
    }
  }
  await walk(root);
  return output;
}

function collectCanonicalExplanations(answerKeys) {
  const explanations = [];
  for (const answerSet of Object.values(answerKeys.quizzes ?? {})) {
    for (const answer of answerSet.answers ?? []) {
      if (typeof answer.explanation === "string" && answer.explanation.length >= 24) {
        explanations.push(answer.explanation);
      }
    }
  }
  return explanations;
}

export async function scanPrototypeQuizLeaks({
  repositoryRoot = resolve("."),
  reportPath = "delivery/phase-02/prototype-quiz-leak-scan.json",
} = {}) {
  const root = resolve(repositoryRoot);
  const answerKeyPath = join(root, "generated/server/quiz-answer-keys.json");
  const answerKeys = JSON.parse(await readFile(answerKeyPath, "utf8"));
  const explanations = collectCanonicalExplanations(answerKeys);
  const matches = [];
  const scanned = [];

  for (const sourceRoot of SOURCE_ROOTS) {
    const absoluteRoot = join(root, sourceRoot);
    for (const file of await listTextFiles(absoluteRoot)) {
      const text = await readFile(file, "utf8");
      const path = relative(root, file).replaceAll("\\", "/");
      scanned.push(path);
      for (const marker of SERVER_BOUNDARY_PATTERNS) {
        if (marker.pattern.test(text)) {
          matches.push({ path, kind: "SOURCE_BOUNDARY_REFERENCE", marker: marker.name });
        }
      }
      for (const explanation of explanations) {
        if (text.includes(explanation)) {
          matches.push({ path, kind: "CANONICAL_EXPLANATION", fingerprint: hash(explanation) });
        }
      }
    }
  }

  for (const reviewRootName of REVIEW_ROOTS) {
    const reviewRoot = join(root, reviewRootName);
    for (const file of await listTextFiles(reviewRoot)) {
      const text = await readFile(file, "utf8");
      const path = relative(root, file).replaceAll("\\", "/");
      scanned.push(path);
      for (const marker of SERVER_BOUNDARY_PATTERNS) {
        if (marker.pattern.test(text)) {
          matches.push({ path, kind: "BROWSER_REVIEW_BOUNDARY_REFERENCE", marker: marker.name });
        }
      }
      for (const explanation of explanations) {
        if (text.includes(explanation)) {
          matches.push({ path, kind: "BROWSER_REVIEW_EXPLANATION", fingerprint: hash(explanation) });
        }
      }
    }
  }

  const report = {
    schemaVersion: "1.0.0",
    result: matches.length === 0 ? "PASS" : "FAIL",
    scannedRoots: [...SOURCE_ROOTS, ...REVIEW_ROOTS],
    filesScanned: scanned.length,
    canonicalExplanationFingerprintsChecked: explanations.length,
    sourceBoundaryMarkersChecked: SERVER_BOUNDARY_PATTERNS.map((item) => item.name),
    matches,
  };
  const target = resolve(root, reportPath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (matches.length > 0) {
    throw new Error(`Prototype quiz leak scan failed with ${matches.length} match(es).`);
  }
  return report;
}

const isDirect = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  : false;

if (isDirect) {
  try {
    console.log(JSON.stringify(await scanPrototypeQuizLeaks(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
