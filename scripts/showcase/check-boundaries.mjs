import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const showcaseRoot = join(repositoryRoot, "src/showcase");
const fixtureRoot = join(repositoryRoot, "src/prototype-fixtures");
const routeRoot = join(repositoryRoot, "app/dev/design-system");
const sourceExtensions = new Set([".ts", ".tsx"]);
const forbiddenSpecifier = /(?:^|\/)(?:generated\/public|generated\/server|server|prototypes\/selected-a)(?:\/|$)|^@\/app(?:\/|$)|^(?:\.\.\/)+app(?:\/|$)/u;
const forbiddenDataMarker = /(?:correctOptionId|correctAnswer|answerKey|answer-key|canonicalExplanation|quiz-answer-key-loader|loadQuizAnswerSet)/u;
const forbiddenFixtureField = /\b(?:userId|accountId|email|password|certificateId|progressHistory|persistedProgress|storedAttempts)\s*:/u;
const forbiddenRuntimeMarker = /(?:\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|\/mnt\/|OneDrive|[A-Za-z]:\\)/u;
const allowedShowcaseSpecifiers = new Set([
  "react",
  "@/src/design-system",
  "@/src/app-shell",
  "@/src/learning",
  "@/src/media",
  "@/src/quiz",
  "@/src/completion",
  "@/src/prototype-fixtures",
]);
const allowedFixtureSpecifiers = new Set([
  "@/src/app-shell",
  "@/src/learning",
  "@/src/media",
  "@/src/quiz",
  "@/src/completion",
]);

async function listSourceFiles(directory) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listSourceFiles(path));
    else if (entry.isFile() && sourceExtensions.has(extname(path))) output.push(path);
  }
  return output;
}

function importSpecifiers(source) {
  return [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/gu)].map((match) => match[1]);
}

async function resolveLocalImport(sourceFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(sourceFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Continue through the deterministic candidate list.
    }
  }
  throw new Error(`Unresolved local import ${specifier} from ${relative(repositoryRoot, sourceFile)}`);
}

const showcaseFiles = await listSourceFiles(showcaseRoot);
const fixtureFiles = await listSourceFiles(fixtureRoot);
const graphFiles = [...showcaseFiles, ...fixtureFiles];
const graph = new Map(graphFiles.map((file) => [file, []]));

for (const file of graphFiles) {
  const source = await readFile(file, "utf8");
  const repositoryPath = relative(repositoryRoot, file).split("\\").join("/");
  if (/\bany\b/u.test(source)) throw new Error(`Broad any is forbidden in ${repositoryPath}`);
  if (forbiddenDataMarker.test(source)) throw new Error(`Server/answer marker is forbidden in ${repositoryPath}`);
  if (forbiddenFixtureField.test(source)) throw new Error(`User, persistence or certificate fixture field is forbidden in ${repositoryPath}`);
  if (forbiddenRuntimeMarker.test(source)) throw new Error(`Runtime, local-path or persistence marker is forbidden in ${repositoryPath}`);

  const allowedSpecifiers = file.startsWith(fixtureRoot) ? allowedFixtureSpecifiers : allowedShowcaseSpecifiers;
  for (const specifier of importSpecifiers(source)) {
    if (forbiddenSpecifier.test(specifier)) throw new Error(`Forbidden showcase import ${specifier} in ${repositoryPath}`);
    if (!specifier.startsWith(".") && !allowedSpecifiers.has(specifier)) {
      throw new Error(`Undocumented showcase dependency ${specifier} in ${repositoryPath}`);
    }
    const resolved = await resolveLocalImport(file, specifier);
    if (resolved && graph.has(resolved)) graph.get(file).push(resolved);
  }
}

const routePage = await readFile(join(routeRoot, "page.tsx"), "utf8");
if (!/process\.env\.NODE_ENV\s*===\s*["']production["']/u.test(routePage) || !/notFound\s*\(\s*\)/u.test(routePage)) {
  throw new Error("The design-system route must call notFound() in production.");
}
if (!/export const dynamic\s*=\s*["']force-dynamic["']/u.test(routePage)) {
  throw new Error("The design-system route must remain force-dynamic.");
}
if (forbiddenDataMarker.test(routePage) || /generated\/server/u.test(routePage)) {
  throw new Error("The design-system route contains a forbidden server/answer marker.");
}

const publicNavigationFiles = [
  "src/prototypes/selected-a/shell-adapter.tsx",
  "src/app-shell/Header.tsx",
  "src/app-shell/PrimaryNavigation.tsx",
  "src/app-shell/ModuleStrip.tsx",
  "app/page.tsx",
  "app/prototype/a/home/page.tsx",
];
for (const repositoryPath of publicNavigationFiles) {
  const source = await readFile(join(repositoryRoot, repositoryPath), "utf8");
  if (/\/dev\/design-system/u.test(source)) {
    throw new Error(`Public navigation references the showcase in ${repositoryPath}`);
  }
}

const visiting = new Set();
const visited = new Set();
function visit(file, trail) {
  if (visiting.has(file)) {
    const start = trail.indexOf(file);
    const cycle = [...trail.slice(start), file].map((entry) => relative(repositoryRoot, entry));
    throw new Error(`Showcase import cycle: ${cycle.join(" -> ")}`);
  }
  if (visited.has(file)) return;
  visiting.add(file);
  for (const dependency of graph.get(file) ?? []) visit(dependency, [...trail, file]);
  visiting.delete(file);
  visited.add(file);
}
for (const file of graphFiles) visit(file, []);

console.log(JSON.stringify({
  result: "PASS",
  showcaseFiles: showcaseFiles.length,
  fixtureFiles: fixtureFiles.length,
  routeFiles: (await readdir(routeRoot, { withFileTypes: true })).filter((entry) => entry.isFile()).length,
  edges: [...graph.values()].reduce((sum, values) => sum + values.length, 0),
  generatedServerImports: 0,
  answerMarkers: 0,
  userOrPersistenceFixtures: 0,
  routeImports: 0,
  publicNavigationLinks: 0,
  broadAny: 0,
  cycles: 0,
  productionGuard: "PASS",
}, null, 2));
