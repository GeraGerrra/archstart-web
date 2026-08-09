import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string { return readFileSync(path, "utf8"); }
const actions = read("src/server/project-workspace-actions.ts");
const inspection = read("src/project-upload/file-inspection.ts");
const runtime = read("src/project-upload/pdfjs-node-runtime.ts");
const nextConfig = read("next.config.ts");
const packageJson = JSON.parse(read("package.json")) as {
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};
const lockfile = read("pnpm-lock.yaml");
const pnpmWorkspace = read("pnpm-workspace.yaml");

test("ordinary project Server Actions do not evaluate the PDF finalization runtime", () => {
  assert.doesNotMatch(actions, /^import\s+\{\s*finalizeProjectUploadAction\s*\}\s+from\s+["']\.\/project-file-finalization-runtime["'];/mu);
  assert.match(actions, /finalizeProjectWorkspaceUploadAction[\s\S]*await import\(\s*["']\.\/project-file-finalization-runtime["']\s*\)/u);
  assert.match(actions, /Проверка файла временно недоступна/u);
});

test("PNG inspection stays independent from PDF.js module evaluation", () => {
  assert.doesNotMatch(inspection, /^import[\s\S]*from\s+["']pdfjs-dist\/legacy\/build\/pdf\.mjs["'];/mu);
  assert.match(inspection, /inspectPdfPageCount[\s\S]*await import\(["']\.\/pdfjs-node-runtime\.ts["']\)/u);
});

test("the PDF-only runtime installs native Node globals before loading PDF.js", () => {
  assert.match(runtime, /from ["']@napi-rs\/canvas["']/u);
  assert.match(runtime, /DOMMatrix/u); assert.match(runtime, /ImageData/u); assert.match(runtime, /Path2D/u);
  assert.match(runtime, /installPdfJsNodeGlobals\(\);[\s\S]*import\(["']pdfjs-dist\/legacy\/build\/pdf\.mjs["']\)/u);
});

test("Vercel production builds use Webpack to avoid Turbopack external-alias symlink packaging", () => {
  assert.equal(
    packageJson.scripts?.build,
    "next build --webpack && node scripts/security/scan-browser-quiz-leaks.mjs",
  );
});

test("Vercel tracing uses a hoisted pnpm layout without manual native-runtime globs", () => {
  assert.equal(packageJson.dependencies?.["pdfjs-dist"], "6.2.108");
  assert.equal(packageJson.dependencies?.["@napi-rs/canvas"], "1.0.3");
  assert.match(lockfile, /'@napi-rs\/canvas':\s*\n\s+specifier: 1\.0\.3\s*\n\s+version: 1\.0\.3/u);
  assert.match(nextConfig, /serverExternalPackages:\s*\[[^\]]*["']@napi-rs\/canvas["'][^\]]*["']pdfjs-dist["'][^\]]*\]/u);
  assert.match(pnpmWorkspace, /^nodeLinker:\s*hoisted\s*$/mu);
  assert.ok(nextConfig.includes("./generated/public/quizzes/**/*.json"));
  assert.ok(nextConfig.includes("./generated/server/quiz-answer-keys.json"));
  assert.doesNotMatch(nextConfig, /outputFileTracingIncludes:[\s\S]*?node_modules\//u);
  assert.doesNotMatch(nextConfig, /@napi-rs\/canvas-linux-x64-(?:gnu|musl)\/\*\*\*/u);
});
