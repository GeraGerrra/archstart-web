import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const quizRoot = join(repositoryRoot, "src/quiz");
const reverseRoots = ["src/design-system", "src/app-shell", "src/learning", "src/media"];
const sourceExtensions = new Set([".ts", ".tsx"]);
const forbiddenSpecifier = /(?:^|\/)(?:prototype-fixtures|prototypes\/selected-a|generated\/public|generated\/server|server)(?:\/|$)|^@\/app(?:\/|$)|^(?:\.\.\/)+app(?:\/|$)/u;
const forbiddenSourceMarker = /(?:quiz-answer-key-loader|loadQuizAnswerSet|correctOptionId|correctAnswer|answerKey|answer-key|canonicalExplanation)/u;
const allowedExternalSpecifiers = new Set(["react", "@/src/design-system"]);

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

function importsQuiz(specifier) {
  return specifier === "@/src/quiz"
    || specifier.startsWith("@/src/quiz/")
    || specifier === "../quiz"
    || specifier.startsWith("../quiz/")
    || specifier === "../../src/quiz"
    || specifier.startsWith("../../src/quiz/");
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

const files = await listSourceFiles(quizRoot);
const graph = new Map(files.map((file) => [file, []]));
let designSystemImports = 0;

for (const file of files) {
  const source = await readFile(file, "utf8");
  const repositoryPath = relative(repositoryRoot, file).split("\\").join("/");
  if (/\bany\b/u.test(source)) throw new Error(`Broad any is forbidden in ${repositoryPath}`);
  if (forbiddenSourceMarker.test(source)) throw new Error(`Server/answer marker is forbidden in ${repositoryPath}`);
  if (/import\s+["'][^"']+\.css["']/u.test(source)) throw new Error(`CSS side-effect import is forbidden in ${repositoryPath}`);

  for (const specifier of importSpecifiers(source)) {
    if (forbiddenSpecifier.test(specifier)) throw new Error(`Forbidden quiz import ${specifier} in ${repositoryPath}`);
    if (specifier === "@/src/design-system") designSystemImports += 1;
    else if (!specifier.startsWith(".") && !allowedExternalSpecifiers.has(specifier)) {
      throw new Error(`Undocumented quiz dependency ${specifier} in ${repositoryPath}`);
    }
    const resolved = await resolveLocalImport(file, specifier);
    if (resolved && graph.has(resolved)) graph.get(file).push(resolved);
  }
}

let reverseImports = 0;
for (const root of reverseRoots) {
  for (const file of await listSourceFiles(join(repositoryRoot, root))) {
    const source = await readFile(file, "utf8");
    for (const specifier of importSpecifiers(source)) {
      if (importsQuiz(specifier)) {
        reverseImports += 1;
        throw new Error(`Reverse ${root} to quiz import ${specifier} in ${relative(repositoryRoot, file)}`);
      }
    }
  }
}

const visiting = new Set();
const visited = new Set();
function visit(file, trail) {
  if (visiting.has(file)) {
    const start = trail.indexOf(file);
    const cycle = [...trail.slice(start), file].map((entry) => relative(repositoryRoot, entry));
    throw new Error(`Quiz import cycle: ${cycle.join(" -> ")}`);
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
  root: relative(repositoryRoot, quizRoot),
  forbiddenImports: 0,
  answerMarkers: 0,
  broadAny: 0,
  cssImports: 0,
  cycles: 0,
  designSystemImports,
  reverseImports,
}, null, 2));
