import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string): string =>
  readFileSync(join(root, path), "utf8");

test("public root redirects to the accepted ARCH.START Home route", () => {
  const page = read("app/page.tsx");

  assert.match(
    page,
    /import\s+\{\s*redirect\s*\}\s+from\s+["']next\/navigation["']/u,
  );
  assert.match(
    page,
    /redirect\(\s*["']\/prototype\/a\/home["']\s*\)/u,
  );
  assert.doesNotMatch(page, /\bnotFound\s*\(/u);
  assert.doesNotMatch(page, /RepositoryFoundationPage/u);
});
