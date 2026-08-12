import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

type MobileCourseMeasurement = {
  viewportCssPx: number;
  overflow: boolean;
};

type HistoricalRuntimeInventoryAuthority = {
  acceptedSource: {
    branch: string;
    gitHead: string;
    gitTree: string;
    sourceContextSha256: string;
    sourceFileCount: number;
  };
  historicalArchive: {
    filename: string;
    sha256: string;
    ownerLocalRetentionRequired: boolean;
    embeddedInGit: boolean;
    sourceFileCount: number;
  };
  historicalSourceHashes: Record<string, string>;
  selectedARouteInstanceCounts: {
    totalSelectedARouteInstances: number;
    canonicalLessonItemPages: number;
    legacyLessonRedirects: number;
  };
  prototypePathCoupling: {
    runtimeSourceFiles: string[];
    runtimeSourceOccurrenceCount: number;
    runtimeSourceFileCount: number;
  };
  floatingControlFinding: {
    result: string;
    classification: string;
  };
  mobileCourseFinding: {
    route: string;
    result: string;
    measurements: MobileCourseMeasurement[];
    deferredP3RepairContract: string[];
    claimBoundary: string;
  };
  p1ChangedPaths: string[];
  mutations: {
    runtimeBehavior: boolean;
    database: boolean;
    storage: boolean;
    vercel: boolean;
    domain: boolean;
    authConfiguration: boolean;
  };
  targetCandidate: {
    addedPathCount: number;
    modifiedPathCount: number;
    deletedPathCount: number;
    runtimeBehaviorChanged: boolean;
    gitTreeSelfReferenceExcluded: boolean;
    gitTreeAuthority: string;
  };
};

const read = (path: string): string => readFileSync(join(root, path), "utf8");
const sha256 = (path: string): string => createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
const authority = JSON.parse(
  read("PHASE08P_P1_HISTORICAL_RUNTIME_INVENTORY_V1.json"),
) as HistoricalRuntimeInventoryAuthority;

const runtimeFiles = [...authority.prototypePathCoupling.runtimeSourceFiles];

test("P1 is pinned to the exact closed Phase 08M source", () => {
  assert.equal(authority.acceptedSource.branch, "phase-08p-production-readiness");
  assert.equal(authority.acceptedSource.gitHead, "4aa5f89fab7b55be3bcead533701e7019fcc629c");
  assert.equal(authority.acceptedSource.gitTree, "c1a2c324995f198269901609286fb7022e92027f");
  assert.equal(authority.acceptedSource.sourceContextSha256, "6a326e0f839716580abc63e31145926029127abf56e00d0f95b8f1ad2479e426");
  assert.equal(authority.acceptedSource.sourceFileCount, 468);
});

test("the owner-local A/B/C archive is exact and intentionally external to Git", () => {
  assert.equal(authority.historicalArchive.filename, "ARCHSTART_PHASE_08P_PASS_1_HISTORICAL_ABC_ARCHIVE.zip");
  assert.equal(authority.historicalArchive.sha256, "47cbf4f7d5ef75d728b01b2f17ee774db83e871c23302408a23469f1c185a584");
  assert.equal(authority.historicalArchive.ownerLocalRetentionRequired, true);
  assert.equal(authority.historicalArchive.embeddedInGit, false);
  assert.equal(authority.historicalArchive.sourceFileCount, 36);
});

test("historical review and A/B/C routes remain byte-pinned during P1", () => {
  for (const [path, digest] of Object.entries(authority.historicalSourceHashes) as [string,string][]) {
    assert.ok(existsSync(join(root, path)), path);
    assert.equal(sha256(path), digest, path);
  }
  assert.match(read("src/prototypes/directions.ts"), /DIRECTION_IDS = \["a", "b", "c"\]/u);
  assert.match(read("app/prototype-review/layout.tsx"), /robots: \{ index: false, follow: false, nocache: true \}/u);
  assert.match(read("app/prototypes/layout.tsx"), /robots: \{ index: false, follow: false, nocache: true \}/u);
});

test("the pre-P2 launch and selected-A route baseline remains recorded as historical authority", () => {
  assert.equal(authority.selectedARouteInstanceCounts.totalSelectedARouteInstances, 342);
  assert.equal(authority.selectedARouteInstanceCounts.canonicalLessonItemPages, 240);
  assert.equal(authority.selectedARouteInstanceCounts.legacyLessonRedirects, 80);
  assert.ok(existsSync(join(root, "app/prototype/a/page.tsx")));
  assert.ok(existsSync(join(root, "app/prototype/a/course/page.tsx")));
  assert.ok(existsSync(join(root, "app/prototype/a/dashboard/page.tsx")));
});

test("the pre-P2 /prototype/a normalization blast radius remains exact in the P1 record", () => {
  assert.equal(runtimeFiles.length, 28);
  assert.equal(authority.prototypePathCoupling.runtimeSourceOccurrenceCount, 63);
  assert.equal(authority.prototypePathCoupling.runtimeSourceFileCount, 28);
  assert.equal(new Set(runtimeFiles).size, 28);
});

test("the floating black control is not application-owned in the accepted source", () => {
  const packageJson = read("package.json");
  const applicationSource = runtimeFiles.map(read).join("\n");
  assert.doesNotMatch(packageJson, /@vercel\/toolbar|vercel-toolbar/iu);
  assert.doesNotMatch(applicationSource, /VercelToolbar|@vercel\/toolbar|vercel-live-feedback/iu);
  assert.equal(authority.floatingControlFinding.result, "NO_APPLICATION_SOURCE_MATCH");
  assert.equal(authority.floatingControlFinding.classification, "DEPLOYMENT_OR_BROWSER_INJECTION_CANDIDATE");
});

test("P1 preserves the browser-reproduced mobile defect as historical authority", () => {
  assert.equal(authority.mobileCourseFinding.route, "/prototype/a/course");
  assert.equal(authority.mobileCourseFinding.result, "BROWSER_GEOMETRY_REPRODUCED_ROOT_CAUSE_PINNED");
  assert.deepEqual(
    authority.mobileCourseFinding.measurements
      .slice(0, 3)
      .map((row) => [row.viewportCssPx, row.overflow]),
    [[390, true], [412, true], [430, true]],
  );
  assert.equal(authority.mobileCourseFinding.measurements.at(-1)?.overflow, false);
  assert.equal(authority.mobileCourseFinding.deferredP3RepairContract.length, 5);
  assert.match(authority.mobileCourseFinding.claimBoundary, /Repair remains deferred to P3/u);
  assert.equal(authority.mutations.runtimeBehavior, false);
});

test("P1 is source-only and does not widen hosted authority", () => {
  assert.deepEqual(authority.p1ChangedPaths, [
    "PHASE08P_PRODUCTION_READINESS_SCOPE_LOCK.md",
    "PHASE08P_P1_HISTORICAL_RUNTIME_INVENTORY.md",
    "PHASE08P_P1_HISTORICAL_RUNTIME_INVENTORY_V1.json",
    "tests/phase08p-p1-historical-runtime-inventory.test.ts",
  ]);
  assert.deepEqual(authority.mutations, {
    runtimeBehavior: false,
    database: false,
    storage: false,
    vercel: false,
    domain: false,
    authConfiguration: false,
  });
  assert.deepEqual(authority.targetCandidate, {
    addedPathCount: 4,
    modifiedPathCount: 0,
    deletedPathCount: 0,
    runtimeBehaviorChanged: false,
    gitTreeSelfReferenceExcluded: true,
    gitTreeAuthority: "EXTERNAL_OWNER_KIT_INPUT_AUTHORITY_JSON",
  });
});
