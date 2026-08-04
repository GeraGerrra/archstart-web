import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const appShellRoot = join(repositoryRoot, "src/app-shell");
const sourceExtensions = new Set([".ts", ".tsx"]);
const forbiddenSpecifier = /(?:^|\/)(?:prototype-fixtures|prototypes\/selected-a|generated\/public|generated\/server|server)(?:\/|$)|^@\/app(?:\/|$)|^\.\.\/\.\.\/app(?:\/|$)/u;
const forbiddenSourceMarker = /(?:quiz-answer-key-loader|loadQuizAnswerSet|correctOptionId|correctAnswer|answer-key)/u;

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
  return [
    ...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/gu),
  ].map((match) => match[1]);
}

async function resolveLocalImport(sourceFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(sourceFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Continue through the deterministic candidate list.
    }
  }
  throw new Error(`Unresolved local import ${specifier} from ${relative(repositoryRoot, sourceFile)}`);
}

const files = await listSourceFiles(appShellRoot);
const graph = new Map(files.map((file) => [file, []]));
for (const file of files) {
  const source = await readFile(file, "utf8");
  const repositoryPath = relative(repositoryRoot, file);
  if (/\bany\b/u.test(source)) throw new Error(`Broad any is forbidden in ${repositoryPath}`);
  if (forbiddenSourceMarker.test(source)) throw new Error(`Server/answer marker is forbidden in ${repositoryPath}`);
  if (/import\s+["'][^"']+\.css["']/u.test(source)) throw new Error(`CSS side-effect import is forbidden in ${repositoryPath}`);

  for (const specifier of importSpecifiers(source)) {
    if (forbiddenSpecifier.test(specifier)) {
      throw new Error(`Forbidden app-shell import ${specifier} in ${repositoryPath}`);
    }
    const resolved = await resolveLocalImport(file, specifier);
    if (resolved && graph.has(resolved)) graph.get(file).push(resolved);
  }
}

const visiting = new Set();
const visited = new Set();
function visit(file, trail) {
  if (visiting.has(file)) {
    const start = trail.indexOf(file);
    const cycle = [...trail.slice(start), file].map((entry) => relative(repositoryRoot, entry));
    throw new Error(`App-shell import cycle: ${cycle.join(" -> ")}`);
  }
  if (visited.has(file)) return;
  visiting.add(file);
  for (const dependency of graph.get(file) ?? []) visit(dependency, [...trail, file]);
  visiting.delete(file);
  visited.add(file);
}
for (const file of files) visit(file, []);

console.log(JSON.stringify({
  result: "PASS",
  files: files.length,
  edges: [...graph.values()].reduce((sum, values) => sum + values.length, 0),
  root: relative(repositoryRoot, appShellRoot),
  forbiddenImports: 0,
  broadAny: 0,
  cycles: 0,
}, null, 2));
