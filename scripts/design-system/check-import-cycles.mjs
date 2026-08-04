import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const designSystemRoot = join(repositoryRoot, "src/design-system");
const sourceExtensions = new Set([".ts", ".tsx"]);
const forbiddenImport = /(?:generated\/server|prototype-fixtures|prototypes\/selected-a|\.\/\.\.\/prototypes)/u;

async function listSourceFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listSourceFiles(path));
    else if (entry.isFile() && sourceExtensions.has(extname(path))) output.push(path);
  }
  return output.sort();
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

const files = await listSourceFiles(designSystemRoot);
const graph = new Map(files.map((file) => [file, []]));
for (const file of files) {
  const source = await readFile(file, "utf8");
  if (forbiddenImport.test(source)) {
    throw new Error(`Forbidden design-system boundary import in ${relative(repositoryRoot, file)}`);
  }
  const specifiers = [
    ...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/gu),
  ].map((match) => match[1]);
  for (const specifier of specifiers) {
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
    throw new Error(`Design-system import cycle: ${cycle.join(" -> ")}`);
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
  root: relative(repositoryRoot, designSystemRoot),
}, null, 2));
