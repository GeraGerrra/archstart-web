import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string): string =>
  readFileSync(join(root, path), "utf8");

test("public root renders the accepted ARCH.START Home surface", () => {
  const page = read("app/page.tsx");

  assert.match(page, /SelectedAHome/u);
  assert.match(page, /loadCourseProgressProjection/u);
  assert.match(page, /export const dynamic\s*=\s*["']force-dynamic["']/u);
  assert.match(page, /progressProjection=\{progressProjection\}/u);
  assert.doesNotMatch(page, /redirect\(\s*["']\/prototype\/a\/home["']\s*\)/u);
  assert.doesNotMatch(page, /RepositoryFoundationPage/u);
});
