import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

async function sourceFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(?:ts|tsx|js|mjs)$/u.test(entry.name)) files.push(path);
    }
  }
  await walk(root);
  return files.sort();
}

function executableSource(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\/\/.*$/gmu, "");
}

test("server-only answer loader uses the Next server-only sentinel", async () => {
  const source = await readFile("src/server/quiz-answer-key-loader.ts", "utf8");
  assert.match(source, /^import "server-only";/u);
  assert.match(source, /generated\/server\/quiz-answer-keys\.json/u);
  assert.match(source, /assertServerQuizAnswerSet/u);
  assert.match(source, /loadQuizAnswerSet/u);
});

test("client-safe barrels expose no server-only answer loader", async () => {
  for (const path of ["src/content-engine/client-safe.ts", "src/client-safe/content.ts"]) {
    const source = executableSource(await readFile(path, "utf8"));
    assert.doesNotMatch(source, /src\/server|quiz-answer-key-loader|loadQuizAnswerSet|generated\/server/u, path);
  }
});

test("browser and inspector source cannot import or read the server answer boundary", async () => {
  const roots = ["app", "src/client-safe", "tools/content-inspector"];
  const forbidden = /quiz-answer-key-loader|loadQuizAnswerSet|generated\/server/u;
  for (const root of roots) {
    for (const path of await sourceFiles(root)) {
      const source = executableSource(await readFile(path, "utf8"));
      assert.doesNotMatch(source, forbidden, path);
    }
  }
});

test("next config includes the server Quiz authority without excluding generated/server from tracing", async () => {
  const source = await readFile("next.config.ts", "utf8");

  assert.match(
    source,
    /outputFileTracingIncludes:[\s\S]*\.\/generated\/server\/quiz-answer-keys\.json/u,
  );

  const excludesBlock = source.match(
    /outputFileTracingExcludes:\s*\{[\s\S]*?\n\s*\},/u,
  );

  assert.ok(
    excludesBlock,
    "outputFileTracingExcludes block is missing",
  );

  assert.doesNotMatch(
    excludesBlock[0],
    /generated\/server/u,
  );
});
