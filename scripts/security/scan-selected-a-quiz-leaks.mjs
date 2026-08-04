#!/usr/bin/env node

import { resolve } from "node:path";
import { scanPrototypeQuizLeaks } from "./scan-prototype-quiz-leaks.mjs";

try {
  const report = await scanPrototypeQuizLeaks({
    repositoryRoot: resolve("."),
    reportPath: "delivery/phase-02-selected-a-ia-v2/security/quiz-leak-scan.json",
  });
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
