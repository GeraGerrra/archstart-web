import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  COURSE_ROUTE,
  DASHBOARD_ROUTE,
  HOME_ROUTE,
  PRIVATE_CERTIFICATE_ROUTE,
  REVIEW_ROUTE,
  canonicalizeLegacySelectedAPathname,
  courseLessonItemRoute,
  courseModuleRoute,
  courseProjectRoute,
  isProtectedProductionPath,
  productionRouteRedirects,
} from "../src/routing/production-routes.ts";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const sha256 = (path: string): string => createHash("sha256").update(readFileSync(join(root, path))).digest("hex");

interface P2Authority {
  acceptedSource: {
    branch: string;
    gitHead: string;
    gitTree: string;
    sourceContextSha256: string;
    sourceFileCount: number;
  };
  canonicalRoutes: Record<string, string>;
  compatibility: {
    redirectCount: number;
    permanent: boolean;
    queryForwarding: string;
    postMethodPreservation: string;
    legacyRouteFilesRetained: boolean;
  };
  security: {
    exactPrivateRoutes: string[];
    publicCertificatePattern: string;
  };
  historicalPreservation: {
    prototypeReviewUnchanged: boolean;
    prototypesUnchanged: boolean;
  };
  mutations: {
    database: boolean;
    storage: boolean;
    vercel: boolean;
    domain: boolean;
    dependencies: boolean;
    css: boolean;
  };
  changedPaths: string[];
  targetCandidate: {
    modifiedPathCount: number;
    addedPathCount: number;
    deletedPathCount: number;
    changedPathCount: number;
    gitTreeSelfReferenceExcluded: boolean;
    gitTreeAuthority: string;
  };
}

const authority = JSON.parse(
  read("PHASE08P_P2_CANONICAL_PRODUCTION_ROUTES_V1.json"),
) as P2Authority;


const expectedChangedPaths = [
  "LEARNING_INFORMATION_ARCHITECTURE.md",
  "PHASE08P_P2_CANONICAL_PRODUCTION_ROUTES.md",
  "PHASE08P_P2_CANONICAL_PRODUCTION_ROUTES_V1.json",
  "ROUTE_LIST.md",
  "app/certificate/page.tsx",
  "app/course/[moduleCode]/[lessonCode]/[item]/LessonActivityRecorder.tsx",
  "app/course/[moduleCode]/[lessonCode]/[item]/page.tsx",
  "app/course/[moduleCode]/[lessonCode]/slides/page.tsx",
  "app/course/[moduleCode]/[lessonCode]/transcript/page.tsx",
  "app/course/[moduleCode]/page.tsx",
  "app/course/[moduleCode]/project/page.tsx",
  "app/course/page.tsx",
  "app/dashboard/page.tsx",
  "app/onboarding/page.tsx",
  "app/page.tsx",
  "app/profile/page.tsx",
  "app/review/page.tsx",
  "next.config.ts",
  "scripts/auth/render-static-review.mjs",
  "src/auth/components/AccountDashboard.tsx",
  "src/auth/components/AuthFrame.tsx",
  "src/auth/redirects.ts",
  "src/auth/static-fixtures.ts",
  "src/certificate/CertificateDashboardCard.tsx",
  "src/certificate/CertificateIssueControl.tsx",
  "src/certificate/PrivateCertificatePage.tsx",
  "src/certificate/PublicCertificateVerificationPage.tsx",
  "src/lib/supabase/proxy.ts",
  "src/prototype-fixtures/selectedA.ts",
  "src/prototypes/selected-a/data.ts",
  "src/prototypes/selected-a/lesson-navigation.ts",
  "src/routing/production-routes.ts",
  "src/server/certificate-actions.ts",
  "src/server/completion-actions.ts",
  "src/server/dashboard-projection.ts",
  "src/server/project-workspace-actions.ts",
  "tests/deployment/d1-deployment-boundary.test.ts",
  "tests/deployment/phase07-pass0-launch-shell.test.ts",
  "tests/phase08m-certificate-functional-surfaces.test.ts",
  "tests/phase08p-p1-historical-runtime-inventory.test.ts",
  "tests/phase08p-p2-canonical-production-routes.test.ts",
] as const;

const canonicalRouteFiles = [
  "app/page.tsx",
  "app/course/page.tsx",
  "app/course/[moduleCode]/page.tsx",
  "app/course/[moduleCode]/project/page.tsx",
  "app/course/[moduleCode]/[lessonCode]/[item]/page.tsx",
  "app/course/[moduleCode]/[lessonCode]/[item]/LessonActivityRecorder.tsx",
  "app/course/[moduleCode]/[lessonCode]/slides/page.tsx",
  "app/course/[moduleCode]/[lessonCode]/transcript/page.tsx",
  "app/dashboard/page.tsx",
  "app/review/page.tsx",
  "app/certificate/page.tsx",
] as const;

const canonicalConsumerFiles = [
  ...canonicalRouteFiles,
  "app/onboarding/page.tsx",
  "app/profile/page.tsx",
  "scripts/auth/render-static-review.mjs",
  "src/auth/components/AccountDashboard.tsx",
  "src/auth/components/AuthFrame.tsx",
  "src/auth/redirects.ts",
  "src/auth/static-fixtures.ts",
  "src/certificate/CertificateDashboardCard.tsx",
  "src/certificate/CertificateIssueControl.tsx",
  "src/certificate/PrivateCertificatePage.tsx",
  "src/certificate/PublicCertificateVerificationPage.tsx",
  "src/lib/supabase/proxy.ts",
  "src/prototype-fixtures/selectedA.ts",
  "src/prototypes/selected-a/data.ts",
  "src/prototypes/selected-a/lesson-navigation.ts",
  "src/server/certificate-actions.ts",
  "src/server/completion-actions.ts",
  "src/server/dashboard-projection.ts",
  "src/server/project-workspace-actions.ts",
] as const;

test("P2 is pinned to the exact committed P1 source", () => {
  assert.equal(authority.acceptedSource.branch, "phase-08p-production-readiness");
  assert.equal(authority.acceptedSource.gitHead, "2d22d354a89f34ccd07848688131328dae822f3a");
  assert.equal(authority.acceptedSource.gitTree, "3b63d00672d25c922c4f457c4df18e8b7c395d2b");
  assert.equal(authority.acceptedSource.sourceContextSha256, "6c7f2057999d1d7b41d66fc4e44a46bca0fd0cb77fa86aeb9cfb5d822495b28e");
  assert.equal(authority.acceptedSource.sourceFileCount, 472);
});

test("the canonical route map and path builders are exact", () => {
  assert.equal(HOME_ROUTE, "/");
  assert.equal(COURSE_ROUTE, "/course");
  assert.equal(DASHBOARD_ROUTE, "/dashboard");
  assert.equal(REVIEW_ROUTE, "/review");
  assert.equal(PRIVATE_CERTIFICATE_ROUTE, "/certificate");
  assert.equal(courseModuleRoute("M08"), "/course/m08");
  assert.equal(courseProjectRoute("M08"), "/course/m08/project");
  assert.equal(courseLessonItemRoute("M08", "L05", "quiz"), "/course/m08/l05/quiz");
  assert.deepEqual(authority.canonicalRoutes, {
    home: "/",
    course: "/course",
    module: "/course/[moduleCode]",
    lessonItem: "/course/[moduleCode]/[lessonCode]/[item]",
    project: "/course/[moduleCode]/project",
    dashboard: "/dashboard",
    review: "/review",
    privateCertificate: "/certificate",
    publicCertificate: "/certificate/[certificateCode]",
  });
});

test("all canonical route wrappers exist and preserve the accepted server surfaces", () => {
  for (const path of canonicalRouteFiles) assert.ok(existsSync(join(root, path)), path);
  assert.match(read("app/page.tsx"), /SelectedAHome/u);
  assert.match(read("app/course/page.tsx"), /SelectedACourse/u);
  assert.match(read("app/course/[moduleCode]/page.tsx"), /loadModuleCompletionSnapshot/u);
  assert.match(read("app/course/[moduleCode]/[lessonCode]/[item]/page.tsx"), /submitQuizAttemptAction/u);
  assert.match(read("app/course/[moduleCode]/project/page.tsx"), /loadLearnerProjectWorkspaceProjection/u);
  assert.match(read("app/dashboard/page.tsx"), /requireOnboardedProfile\("\/dashboard"\)/u);
  assert.match(read("app/review/page.tsx"), /requireOnboardedProfile\("\/review"\)/u);
  assert.match(read("app/certificate/page.tsx"), /requireOnboardedProfile\("\/certificate"\)/u);
});

test("legacy selected-A URLs have ordered permanent compatibility redirects", () => {
  const redirects = productionRouteRedirects();
  assert.equal(redirects.length, authority.compatibility.redirectCount);
  assert.ok(redirects.every((entry) => entry.permanent === true));
  assert.equal(authority.compatibility.permanent, true);
  assert.equal(authority.compatibility.queryForwarding, "NEXT_CONFIG_UNCONSUMED_QUERY_PARAMETERS_FORWARDED");
  assert.equal(authority.compatibility.postMethodPreservation, "PERMANENT_308_METHOD_PRESERVING");

  const bySource = new Map(redirects.map((entry) => [entry.source, entry.destination]));
  assert.equal(bySource.get("/prototype/a"), "/");
  assert.equal(bySource.get("/prototype/a/home"), "/");
  assert.equal(bySource.get("/prototype/a/course"), "/course");
  assert.equal(bySource.get("/prototype/a/course/:path*"), "/course/:path*");
  assert.equal(bySource.get("/prototype/a/dashboard"), "/dashboard");
  assert.equal(bySource.get("/prototype/a/review"), "/review");
  assert.equal(bySource.get("/prototype/a/certificate"), "/certificate");
  assert.equal(
    bySource.get("/prototype/a/course/:moduleCode/:lessonCode/slides"),
    "/course/:moduleCode/:lessonCode/lecture-materials",
  );
  assert.equal(
    bySource.get("/course/:moduleCode/:lessonCode/transcript"),
    "/course/:moduleCode/:lessonCode/lecture-materials",
  );

  const wildcardIndex = redirects.findIndex((entry) => entry.source === "/prototype/a/course/:path*");
  const slidesIndex = redirects.findIndex((entry) => entry.source.endsWith("/slides"));
  const transcriptIndex = redirects.findIndex((entry) => entry.source.endsWith("/transcript"));
  assert.ok(slidesIndex >= 0 && slidesIndex < wildcardIndex);
  assert.ok(transcriptIndex >= 0 && transcriptIndex < wildcardIndex);
  assert.match(read("next.config.ts"), /\.\.\.productionRouteRedirects\(\)/u);
});

test("Auth destinations canonicalize old selected-A paths without widening redirects", () => {
  assert.equal(canonicalizeLegacySelectedAPathname("/prototype/a/home"), "/");
  assert.equal(canonicalizeLegacySelectedAPathname("/prototype/a/course/m01"), "/course/m01");
  assert.equal(
    canonicalizeLegacySelectedAPathname("/prototype/a/course/m01/l01/slides"),
    "/course/m01/l01/lecture-materials",
  );
  assert.equal(canonicalizeLegacySelectedAPathname("/prototype/a/dashboard"), "/dashboard");
  assert.equal(canonicalizeLegacySelectedAPathname("/auth/sign-in"), "/auth/sign-in");
  const redirectsSource = read("src/auth/redirects.ts");
  assert.match(redirectsSource, /DEFAULT_ACCOUNT_DESTINATION = "\/dashboard"/u);
  assert.match(redirectsSource, /canonicalizeLegacySelectedAPathname/u);
  assert.match(redirectsSource, /resolved\.search/u);
  assert.match(redirectsSource, /resolved\.hash/u);
});

test("private canonical routes are exact while public certificate verification stays public", () => {
  for (const path of authority.security.exactPrivateRoutes) {
    assert.equal(isProtectedProductionPath(path), true, path);
  }
  assert.equal(isProtectedProductionPath("/certificate/as-0123456789abcdef0123456789abcdef"), false);
  assert.equal(isProtectedProductionPath("/course/m01/l01/overview"), false);
  assert.equal(authority.security.publicCertificatePattern, "/certificate/[certificateCode]");
  assert.match(read("src/lib/supabase/proxy.ts"), /isProtectedProductionPath/u);
});

test("live navigation, revalidation and certificate controls no longer emit prototype paths", () => {
  for (const path of canonicalConsumerFiles) {
    assert.doesNotMatch(read(path), /\/prototype\/a/u, path);
  }
  assert.match(read("src/prototypes/selected-a/data.ts"), /pathHome = HOME_ROUTE/u);
  assert.match(read("src/server/completion-actions.ts"), /revalidatePath\(HOME_ROUTE\)/u);
  assert.match(read("src/server/project-workspace-actions.ts"), /revalidatePath\(REVIEW_ROUTE\)/u);
  assert.match(read("src/server/certificate-actions.ts"), /revalidatePath\("\/certificate"\)/u);
});

test("legacy route source and historical A/B/C evidence remain preserved during P2", () => {
  assert.equal(authority.compatibility.legacyRouteFilesRetained, true);
  assert.ok(existsSync(join(root, "app/prototype/a/home/page.tsx")));
  assert.ok(existsSync(join(root, "app/prototype/a/course/page.tsx")));
  assert.ok(existsSync(join(root, "app/prototype/a/dashboard/page.tsx")));
  const p1 = JSON.parse(read("PHASE08P_P1_HISTORICAL_RUNTIME_INVENTORY_V1.json")) as {
    historicalSourceHashes: Record<string, string>;
  };
  for (const [path, digest] of Object.entries(p1.historicalSourceHashes)) {
    assert.equal(sha256(path), digest, path);
  }
  assert.equal(authority.historicalPreservation.prototypeReviewUnchanged, true);
  assert.equal(authority.historicalPreservation.prototypesUnchanged, true);
});

test("P2 remains source-only and its exact path set defers later launch passes", () => {
  assert.deepEqual(authority.mutations, {
    database: false,
    storage: false,
    vercel: false,
    domain: false,
    dependencies: false,
    css: false,
  });
  const changedPathSet = new Set<string>(authority.changedPaths);
  assert.deepEqual(authority.changedPaths, [...expectedChangedPaths]);
  assert.deepEqual(authority.targetCandidate, {
    modifiedPathCount: 27,
    addedPathCount: 14,
    deletedPathCount: 0,
    changedPathCount: 41,
    gitTreeSelfReferenceExcluded: true,
    gitTreeAuthority: "EXTERNAL_OWNER_KIT_INPUT_AUTHORITY_JSON",
  });
  assert.equal(changedPathSet.has("app/globals.css"), false);
  assert.equal(changedPathSet.has("app/layout.tsx"), false);
  assert.equal(changedPathSet.has("package.json"), false);
  assert.equal(changedPathSet.has("pnpm-lock.yaml"), false);
  assert.ok(authority.changedPaths.every((path) => !path.startsWith("supabase/")));
});
