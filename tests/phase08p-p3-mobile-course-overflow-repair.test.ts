import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const sha256 = (path: string): string => createHash("sha256").update(readFileSync(join(root, path))).digest("hex");

type Measurement = {
  viewportCssPx: number;
  gridWidthPx: number;
  widestCardWidthPx: number;
  computedCardHeadingFontPx: number;
  overflow: boolean;
};

type P3Authority = {
  acceptedSource: {
    branch: string;
    gitHead: string;
    gitTree: string;
    sourceContextSha256: string;
    sourceFileCount: number;
    sourceSizeBytes: number;
    p2HostedAcceptance: string;
  };
  surface: {
    canonicalRoute: string;
    legacyRoute: string;
    runtimeChangeFile: string;
    markupChange: boolean;
  };
  historicalDefect: {
    authority: string;
    classification: string;
    beforeMeasurements: Array<{ viewportCssPx: number; overflow: boolean }>;
  };
  repairContract: {
    courseModuleBounded: boolean;
    singleColumnTrack: string;
    identityTextTrack: string;
    lessonTextTrack: string;
    projectTextTrack: string;
    mobileCardHeadingPx: number;
    mobileCardHeadingLineHeight: number;
    overflowWrapping: boolean;
    genericMobileH2Preserved: boolean;
    overflowMaskAdded: boolean;
  };
  browserGeometry: {
    method: string;
    afterMeasurements: Measurement[];
    desktopGeometryPreserved: Array<{ viewportCssPx: number; gridWidthPx: number; widestCardWidthPx: number }>;
    hostedPreviewRequired: boolean;
  };
  preservedSourceHashes: Record<string, string>;
  changedPaths: string[];
  targetCandidate: {
    modifiedPathCount: number;
    addedPathCount: number;
    deletedPathCount: number;
    changedPathCount: number;
    gitTreeSelfReferenceExcluded: boolean;
    gitTreeAuthority: string;
  };
  mutations: Record<string, boolean>;
  hostedAcceptance: {
    viewports: number[];
    allEightModulesVisible: boolean;
    rightBordersInsideViewport: boolean;
    noHorizontalScroll: boolean;
    desktopParity: boolean;
    anonymousLearnerParity: boolean;
    runtimeLogsZeroNewErrors: boolean;
  };
  nextPass: string;
};

const authority = JSON.parse(
  read("PHASE08P_P3_MOBILE_COURSE_OVERFLOW_REPAIR_V1.json"),
) as P3Authority;

const expectedChangedPaths = [
  "PHASE08P_P3_MOBILE_COURSE_OVERFLOW_REPAIR.md",
  "PHASE08P_P3_MOBILE_COURSE_OVERFLOW_REPAIR_V1.json",
  "app/globals.css",
  "tests/phase08p-p1-historical-runtime-inventory.test.ts",
  "tests/phase08p-p3-mobile-course-overflow-repair.test.ts",
];

test("P3 is pinned to the exact hosted-accepted P2 source", () => {
  assert.equal(authority.acceptedSource.branch, "phase-08p-production-readiness");
  assert.equal(authority.acceptedSource.gitHead, "ece3e92253c95fda9eb103ba40aa53cf53382424");
  assert.equal(authority.acceptedSource.gitTree, "5917f60ad09d107d829a8b8a9bc7094bc6f5a2d7");
  assert.equal(authority.acceptedSource.sourceContextSha256, "7a164a90754c7f4255907502fa1f1aec25bf68992566bc695479dbece5d71fbc");
  assert.equal(authority.acceptedSource.sourceFileCount, 486);
  assert.equal(authority.acceptedSource.sourceSizeBytes, 10462872);
  assert.equal(authority.acceptedSource.p2HostedAcceptance, "OWNER_CONFIRMED_ALL_TESTS_PASS");
});

test("the historical mobile defect remains recorded without pinning broken CSS", () => {
  const p1 = JSON.parse(read("PHASE08P_P1_HISTORICAL_RUNTIME_INVENTORY_V1.json")) as {
    mobileCourseFinding: { result: string; measurements: Array<{ viewportCssPx: number; overflow: boolean }> };
  };
  assert.equal(p1.mobileCourseFinding.result, "BROWSER_GEOMETRY_REPRODUCED_ROOT_CAUSE_PINNED");
  assert.deepEqual(
    p1.mobileCourseFinding.measurements.slice(0, 3).map((row) => [row.viewportCssPx, row.overflow]),
    [[390, true], [412, true], [430, true]],
  );
  assert.equal(authority.historicalDefect.authority, "PHASE08P_P1_HISTORICAL_RUNTIME_INVENTORY_V1.json");
  assert.equal(authority.historicalDefect.classification, "CLIPPED_MIN_CONTENT_OVERFLOW");
  assert.ok(authority.historicalDefect.beforeMeasurements.every((row) => row.overflow));
});

test("course cards and their text tracks have explicit shrink boundaries", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.asa-course-module \{[^}]*width: 100%;[^}]*min-width: 0;[^}]*max-width: 100%;/u);
  assert.match(css, /\.asa-course-module header \{ min-width: 0; \}/u);
  assert.match(css, /\.asa-course-module__identity \{[^}]*min-width: 0;[^}]*grid-template-columns: 54px minmax\(0, 1fr\) auto;/u);
  assert.match(css, /\.asa-course-module__identity > div \{ min-width: 0; \}/u);
  assert.match(css, /\.asa-course-module__lessons li \{[^}]*min-width: 0;[^}]*grid-template-columns: 12px 28px minmax\(0, 1fr\) auto;/u);
  assert.match(css, /\.asa-course-module__project \{[^}]*min-width: 0;[^}]*grid-template-columns: 58px minmax\(0, 1fr\) auto;/u);
});

test("mobile card typography is reasserted after the generic mobile heading rule", () => {
  const css = read("app/globals.css");
  const mobileStart = css.indexOf("@media (max-width: 640px)");
  const genericHeading = css.indexOf(".asa h2 { font-size: clamp(2rem, 10vw, 3.1rem); }", mobileStart);
  const cardHeading = css.indexOf(".asa .asa-course-module__identity h2 { font-size: 22px; line-height: 1.18; }", mobileStart);
  assert.ok(mobileStart >= 0);
  assert.ok(genericHeading > mobileStart);
  assert.ok(cardHeading > genericHeading);
  assert.match(css, /\.asa-course-module__identity h2 \{[^}]*overflow-wrap: anywhere;[^}]*hyphens: auto;/u);
  assert.equal(authority.repairContract.mobileCardHeadingPx, 22);
  assert.equal(authority.repairContract.mobileCardHeadingLineHeight, 1.18);
  assert.equal(authority.repairContract.genericMobileH2Preserved, true);
});

test("single-column, lesson and project mobile tracks use minmax zero minimums", () => {
  const css = read("app/globals.css");
  assert.match(css, /@media \(max-width: 920px\)[\s\S]*?\.asa-course-list__grid \{ grid-template-columns: minmax\(0, 1fr\); \}/u);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.asa-course-module__identity \{ grid-template-columns: 45px minmax\(0, 1fr\); \}/u);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.asa-course-module__lessons li \{ grid-template-columns: 10px 25px minmax\(0, 1fr\); \}/u);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.asa-course-module__project \{ grid-template-columns: 48px minmax\(0, 1fr\); \}/u);
  assert.equal(authority.repairContract.singleColumnTrack, "minmax(0, 1fr)");
  assert.equal(authority.repairContract.overflowMaskAdded, false);
});

test("browser geometry covers the full mobile and responsive boundary matrix", () => {
  const after = authority.browserGeometry.afterMeasurements;
  assert.deepEqual(after.map((row) => row.viewportCssPx), [320, 360, 375, 390, 412, 430, 640, 641, 920, 921]);
  for (const row of after) {
    assert.equal(row.overflow, false, `${row.viewportCssPx}px`);
    assert.ok(row.widestCardWidthPx <= row.gridWidthPx + 0.05, `${row.viewportCssPx}px`);
    assert.equal(row.computedCardHeadingFontPx, 22, `${row.viewportCssPx}px`);
  }
  assert.equal(authority.browserGeometry.method, "HEADLESS_CHROMIUM_EXACT_PRODUCTION_CSS_TOKENS_ALL_EIGHT_REAL_COURSE_MODULES");
  assert.equal(authority.browserGeometry.hostedPreviewRequired, true);
  assert.deepEqual(authority.browserGeometry.desktopGeometryPreserved.map((row) => row.viewportCssPx), [1024, 1440]);
});

test("React course markup, production routes and dependency authority stay byte-pinned", () => {
  for (const [path, digest] of Object.entries(authority.preservedSourceHashes)) {
    assert.equal(sha256(path), digest, path);
  }
  assert.equal(authority.surface.canonicalRoute, "/course");
  assert.equal(authority.surface.legacyRoute, "/prototype/a/course");
  assert.equal(authority.surface.runtimeChangeFile, "app/globals.css");
  assert.equal(authority.surface.markupChange, false);
});

test("P3 has an exact five-path source-only scope", () => {
  assert.deepEqual(authority.changedPaths, expectedChangedPaths);
  assert.deepEqual(authority.targetCandidate, {
    modifiedPathCount: 2,
    addedPathCount: 3,
    deletedPathCount: 0,
    changedPathCount: 5,
    gitTreeSelfReferenceExcluded: true,
    gitTreeAuthority: "EXTERNAL_OWNER_KIT_INPUT_AUTHORITY_JSON",
  });
  assert.deepEqual(authority.mutations, {
    runtimeCss: true,
    reactMarkup: false,
    routes: false,
    redirects: false,
    auth: false,
    database: false,
    storage: false,
    vercel: false,
    domain: false,
    dependencies: false,
    content: false,
  });
  const changedPathSet = new Set<string>(authority.changedPaths);
  assert.equal(changedPathSet.has("next.config.ts"), false);
  assert.equal(changedPathSet.has("package.json"), false);
  assert.equal(changedPathSet.has("pnpm-lock.yaml"), false);
  assert.ok(authority.changedPaths.every((path) => !path.startsWith("supabase/")));
  assert.equal(authority.nextPass, "P4_FLOATING_PREVIEW_CONTROL_CLASSIFICATION_AND_REMOVAL");
});

test("hosted acceptance is explicit and checks visual rather than database authority", () => {
  assert.deepEqual(authority.hostedAcceptance.viewports, [320, 360, 375, 390, 412, 430, 640, 768, 920, 1024, 1440]);
  assert.equal(authority.hostedAcceptance.allEightModulesVisible, true);
  assert.equal(authority.hostedAcceptance.rightBordersInsideViewport, true);
  assert.equal(authority.hostedAcceptance.noHorizontalScroll, true);
  assert.equal(authority.hostedAcceptance.desktopParity, true);
  assert.equal(authority.hostedAcceptance.anonymousLearnerParity, true);
  assert.equal(authority.hostedAcceptance.runtimeLogsZeroNewErrors, true);
});
