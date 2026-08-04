import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { generateContentAtomic } from "../../src/content-engine/generator.ts";

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const sourceRoot = argument("--source") ?? process.env.ARCHSTART_SOURCE_ROOT ?? null;
const outputRoot = resolve(argument("--output") ?? "generated");
const generatedAt = argument("--generated-at") ?? process.env.ARCHSTART_GENERATED_AT ?? undefined;
const explicitSnapshot = argument("--accepted-snapshot");
const snapshotComparisonDisabled = process.argv.includes("--no-snapshot-compare");

if (!sourceRoot) {
  console.error("Immutable ARCH.START source root is required. Usage: pnpm content:generate -- --source <immutable-source-root>");
  process.exitCode = 2;
} else {
  let acceptedM01SnapshotPath: string | null = null;
  if (!snapshotComparisonDisabled) {
    acceptedM01SnapshotPath = explicitSnapshot ? resolve(explicitSnapshot) : resolve(outputRoot, "public/m01-dataset.json");
    try { await access(acceptedM01SnapshotPath); } catch { acceptedM01SnapshotPath = null; }
  }
  try {
    const summary = await generateContentAtomic({
      sourceRoot: resolve(sourceRoot),
      outputRoot,
      generatedAt,
      acceptedM01SnapshotPath,
    });
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
