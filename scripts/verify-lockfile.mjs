import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function sectionBody(text, name, nextNames) {
  const start = text.search(new RegExp(`^${name}:\\s*$`, "m"));
  if (start < 0) return null;
  const afterStart = text.indexOf("\n", start) + 1;
  let end = text.length;
  for (const next of nextNames) {
    const match = text.slice(afterStart).search(new RegExp(`^${next}:\\s*$`, "m"));
    if (match >= 0) end = Math.min(end, afterStart + match);
  }
  return text.slice(afterStart, end);
}

function hasTopLevelEntries(body) {
  return typeof body === "string" && /^  [^\s#][^\n]*:\s*$/m.test(body);
}

export async function verifyCompleteLockfile({ lockfilePath = "pnpm-lock.yaml", packagePath = "package.json" } = {}) {
  const lockfile = await readFile(resolve(lockfilePath), "utf8");
  const pkg = JSON.parse(await readFile(resolve(packagePath), "utf8"));
  const issues = [];
  if (!/^lockfileVersion:\s*['"]?\d/m.test(lockfile)) issues.push("lockfileVersion is absent.");
  const importers = sectionBody(lockfile, "importers", ["packages", "snapshots"]);
  const packages = sectionBody(lockfile, "packages", ["snapshots"]);
  const snapshots = sectionBody(lockfile, "snapshots", []);
  if (!hasTopLevelEntries(importers)) issues.push("importers is empty.");
  if (!hasTopLevelEntries(packages)) issues.push("packages is empty; transitive resolutions were not committed.");
  if (!hasTopLevelEntries(snapshots)) issues.push("snapshots is empty; reproducible dependency graph snapshots were not committed.");
  for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const directBlockPattern = new RegExp(
      `^\\s{6}['\"]?${escapedName}['\"]?:\\s*\\n((?:\\s{8}[^\\n]*\\n?)+)`,
      "mu",
    );
    const directBlock = directBlockPattern.exec(importers ?? "")?.[1] ?? "";
    const escapedVersion = String(version).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const directVersion = new RegExp(`^\\s{8}specifier:\\s*['\"]?${escapedVersion}['\"]?\\s*$`, "mu");
    if (!directBlock || !directVersion.test(directBlock)) {
      issues.push(`Direct dependency ${name}@${version} is not represented in the lockfile importer.`);
    }
  }
  const result = {
    schemaVersion: "1.0.0",
    result: issues.length ? "FAIL" : "PASS",
    packageManager: pkg.packageManager,
    directDependencyCount: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length,
    packagesPopulated: hasTopLevelEntries(packages),
    snapshotsPopulated: hasTopLevelEntries(snapshots),
    issues,
  };
  if (issues.length) throw new Error(`Incomplete pnpm lockfile: ${issues.join(" ")}`);
  return result;
}

const isDirect = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href === import.meta.url : false;
if (isDirect) {
  try { console.log(JSON.stringify(await verifyCompleteLockfile(), null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; }
}
