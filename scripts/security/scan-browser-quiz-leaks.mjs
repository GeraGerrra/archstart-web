import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function listFiles(root) {
  const output = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) output.push(path);
    }
  }
  await walk(root);
  return output.sort();
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function collectSensitiveNeedles(answerKeyFile) {
  const markers = [
    '"correctOptionId"',
    '"correctAnswer"',
    '"answerKey"',
  ];
  const explanations = [];
  for (const answerSet of Object.values(answerKeyFile.quizzes ?? {})) {
    for (const answer of answerSet.answers ?? []) {
      if (typeof answer.explanation === "string" && answer.explanation.length >= 24) explanations.push(answer.explanation);
    }
  }
  return { markers, explanations };
}

export async function scanBrowserQuizLeaks({
  staticRoot,
  answerKeyPath,
  reportPath = null,
} = {}) {
  const root = resolve(staticRoot ?? ".next/static");
  const keyPath = resolve(answerKeyPath ?? "generated/server/quiz-answer-keys.json");
  if (!(await stat(root)).isDirectory()) throw new Error(`Browser static root does not exist: ${root}`);
  const answerKeys = JSON.parse(await readFile(keyPath, "utf8"));
  const { markers, explanations } = collectSensitiveNeedles(answerKeys);
  const files = await listFiles(root);
  const matches = [];

  for (const file of files) {
    const buffer = await readFile(file);
    const text = buffer.toString("utf8");
    for (const marker of markers) {
      if (text.includes(marker)) matches.push({ file: relative(root, file), kind: "SERVER_FIELD_MARKER", fingerprint: hash(marker) });
    }
    for (const explanation of explanations) {
      if (text.includes(explanation)) matches.push({ file: relative(root, file), kind: "EXPLANATION_TEXT", fingerprint: hash(explanation) });
    }
  }

  const report = {
    schemaVersion: "1.0.0",
    result: matches.length === 0 ? "PASS" : "FAIL",
    staticRoot: ".next/static",
    filesScanned: files.length,
    serverFieldMarkersChecked: markers.length,
    explanationFingerprintsChecked: explanations.length,
    matches,
  };
  if (reportPath) {
    await import("node:fs/promises").then(({ mkdir }) => mkdir(dirname(resolve(reportPath)), { recursive: true }));
    await writeFile(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (matches.length) {
    throw new Error(`Browser quiz leak scan failed with ${matches.length} match(es): ${matches.map((item) => `${item.file}:${item.kind}`).join(", ")}`);
  }
  return report;
}

const isDirectExecution = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  : false;

if (isDirectExecution) {
  try {
    const report = await scanBrowserQuizLeaks({ reportPath: "delivery/browser-quiz-leak-scan.json" });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
