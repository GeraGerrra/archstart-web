import { resolve } from "node:path";
import { validateGeneratedTree } from "../../src/content-engine/generator.ts";

const outputFlag = process.argv.indexOf("--generated");
const outputRoot = resolve(outputFlag >= 0 ? process.argv[outputFlag + 1] ?? "generated" : "generated");
try {
  await validateGeneratedTree(outputRoot);
  console.log(JSON.stringify({ result: "PASS", generatedRoot: outputRoot.endsWith("/generated") ? "generated" : "custom generated root" }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
