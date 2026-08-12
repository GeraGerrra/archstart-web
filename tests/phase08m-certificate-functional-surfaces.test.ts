import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const sha256 = (path: string): string => createHash("sha256").update(readFileSync(join(root, path))).digest("hex");

const model = read("src/certificate/model.ts");
const types = read("src/certificate/types.ts");
const projection = read("src/server/certificate-projection.ts");
const actions = read("src/server/certificate-actions.ts");
const issueControl = read("src/certificate/CertificateIssueControl.tsx");
const dashboardCard = read("src/certificate/CertificateDashboardCard.tsx");
const privatePage = read("src/certificate/PrivateCertificatePage.tsx");
const artwork = read("src/certificate/CertificateArtwork.tsx");
const printControl = read("src/certificate/CertificatePrintControl.tsx");
const publicPage = read("src/certificate/PublicCertificateVerificationPage.tsx");
const certificateIndex = read("src/certificate/index.ts");
const legacyPrivateRoute = read("app/prototype/a/certificate/page.tsx");
const canonicalPrivateRoute = read("app/certificate/page.tsx");
const publicRoute = read("app/certificate/[certificateCode]/page.tsx");
const legacyDashboardRoute = read("app/prototype/a/dashboard/page.tsx");
const canonicalDashboardRoute = read("app/dashboard/page.tsx");
const dashboard = read("src/learning/dashboard/DashboardPage.tsx");
const selectedA = read("src/prototypes/selected-a/SelectedAPrototype.tsx");
const css = read("app/globals.css");
const scope = read("PHASE08M_CERTIFICATE_FUNCTIONAL_SURFACES.md");
const visualScope = read("PHASE08M_CERTIFICATE_VISUAL_DESIGN.md");
const packageJson = JSON.parse(read("package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
const authority = JSON.parse(read("PHASE08M_CERTIFICATE_FUNCTIONAL_SURFACES_V1.json")) as {
  acceptedBase: { gitHead: string; gitTree: string; certificateRows: number; certificateStorageBuckets: number };
  routes: { private: string; publicVerification: string };
  states: string[];
  excluded: string[];
  visualDesignGate: string;
};

test("Pass 2 is pinned to the hosted-accepted Pass 1 source and zero certificate state", () => {
  assert.equal(authority.acceptedBase.gitHead, "c00bbf09eaf83476719011d12ac4176894f0f3e5");
  assert.equal(authority.acceptedBase.gitTree, "5a1ef0134511be38e505c708fe2b20c583d46607");
  assert.equal(authority.acceptedBase.certificateRows, 0);
  assert.equal(authority.acceptedBase.certificateStorageBuckets, 0);
  assert.match(scope, /hosted certificate authority: accepted/u);
});

test("the accepted certificate routes remain present and P2 adds the canonical private route", () => {
  assert.equal(authority.routes.private, "/prototype/a/certificate");
  assert.equal(authority.routes.publicVerification, "/certificate/[certificateCode]");
  assert.ok(existsSync(join(root, "app/prototype/a/certificate/page.tsx")));
  assert.ok(existsSync(join(root, "app/certificate/page.tsx")));
  assert.ok(existsSync(join(root, "app/certificate/[certificateCode]/page.tsx")));
  assert.match(legacyPrivateRoute, /requireOnboardedProfile\("\/prototype\/a\/certificate"\)/u);
  assert.match(canonicalPrivateRoute, /requireOnboardedProfile\("\/certificate"\)/u);
  for (const route of [legacyPrivateRoute, canonicalPrivateRoute]) {
    assert.match(route, /from "@\/src\/certificate\/PrivateCertificatePage"/u);
    assert.match(route, /loadMyCertificateProjection\(\)/u);
    assert.match(route, /loadCourseProgressProjection\(\)/u);
  }
  assert.match(publicRoute, /from "@\/src\/certificate\/PublicCertificateVerificationPage"/u);
  assert.match(publicRoute, /loadPublicCertificateVerification\(certificateCode\)/u);
  assert.match(artwork, /^import "server-only";/u);
  assert.doesNotMatch(
    certificateIndex,
    /CertificateArtwork|PrivateCertificatePage|PublicCertificateVerificationPage/u,
  );
});

test("certificate state parsing is exact and issued names come from immutable own-row snapshots", () => {
  assert.match(types, /"locked"[\s\S]*"eligible"[\s\S]*"issued"[\s\S]*"revoked"[\s\S]*"unavailable"/u);
  assert.match(model, /parseMyCertificateEligibility/u);
  assert.match(model, /parseOwnCertificateSnapshot/u);
  assert.match(model, /display_name_snapshot/u);
  assert.match(model, /courseCode !== COURSE_CODE/u);
  assert.match(model, /certificateId !== eligibility\.certificateReference\.certificateId/u);
  assert.doesNotMatch(model, /displayName:\s*eligibility\.displayNamePreview/u);
});

test("private projection is server-only, fail-closed, and uses accepted RPC plus own-row RLS", () => {
  assert.match(projection, /^import "server-only";/u);
  assert.match(projection, /rpc\(\s*"get_my_course_certificate_eligibility"/u);
  assert.match(projection, /from\("course_certificates"\)/u);
  assert.match(projection, /\.eq\("id", eligibility\.certificateReference\.certificateId\)/u);
  assert.match(projection, /unavailableCertificateProjection\(\)/gu);
  assert.doesNotMatch(projection, /createSecretSupabaseClient|SUPABASE_SECRET_KEY/u);
  assert.doesNotMatch(projection, /\.eq\("user_id"/u);
});

test("issuance action is parameter-free, authenticated, onboarding-gated, and database-owned", () => {
  assert.match(actions, /^"use server";/u);
  assert.match(actions, /export async function issueMyCourseCertificateAction\(\)/u);
  assert.doesNotMatch(actions, /issueMyCourseCertificateAction\([^)]*(?:user|code|name|eligible|formData|input)/iu);
  assert.match(actions, /client\.auth\.getClaims\(\)/u);
  assert.match(actions, /select\("onboarding_completed_at"\)/u);
  assert.match(actions, /rpc\("issue_my_course_certificate"\)/u);
  assert.match(actions, /error\.code === "23514"/u);
  assert.match(actions, /error\.code === "55000"/u);
  assert.doesNotMatch(actions, /p_user_id|p_display_name|p_certificate_code|p_eligible|createSecretSupabaseClient/u);
});

test("client issuance control sends no authority payload and refreshes the private route", () => {
  assert.match(issueControl, /^"use client";/u);
  assert.match(issueControl, /issueMyCourseCertificateAction\(\)/u);
  assert.match(issueControl, /router\.push\("\/certificate"\)/u);
  assert.doesNotMatch(issueControl, /FormData|userId|certificateCode:|displayName|eligible:/u);
});

test("Dashboard exposes truthful locked, eligible, issued, revoked, and unavailable states", () => {
  for (const state of ["unavailable", "locked", "eligible", "issued", "revoked"]) {
    assert.match(dashboardCard, new RegExp(`projection\\.state === "${state}"|state: "${state}"`, "u"));
  }
  for (const route of [legacyDashboardRoute, canonicalDashboardRoute]) {
    assert.match(route, /Promise\.all\([\s\S]*loadDashboardProjection[\s\S]*loadMyCertificateProjection/u);
    assert.match(route, /certificateProjection=\{certificateProjection\}/u);
  }
  assert.match(selectedA, /certificateProjection\?: MyCertificateProjection/u);
  assert.match(dashboard, /CertificateDashboardCard projection=\{certificateProjection\}/u);
  assert.match(dashboardCard, /completedLessons[\s\S]*requiredLessons/u);
  assert.match(dashboardCard, /acceptedProjects[\s\S]*requiredProjects/u);
});

test("private functional page covers all states and renders the immutable snapshot artwork", () => {
  for (const copy of [
    "Сертификат пока недоступен",
    "Сертификат доступен",
    "Сертификат о завершении курса",
    "Отозван",
  ]) assert.match(privatePage, new RegExp(copy, "u"));
  assert.match(privatePage, /CertificateArtwork/u);
  assert.match(privatePage, /certificateCode=\{certificate\.certificateCode\}/u);
  assert.match(privatePage, /displayName=\{certificate\.displayName\}/u);
  assert.match(privatePage, /publicCertificatePath\(certificate\.certificateCode\)/u);
  assert.match(artwork, /не является государственной аккредитацией/u);
  assert.doesNotMatch(`${privatePage}\n${artwork}`, /email|userId|revocationReason|project file|reviewer/iu);
});

test("public verification is noindex, generic for malformed or unknown codes, and minimally disclosed", () => {
  assert.match(publicRoute, /index:\s*false/u);
  assert.match(publicRoute, /follow:\s*false/u);
  assert.match(publicRoute, /nocache:\s*true/u);
  assert.match(model, /CERTIFICATE_CODE_PATTERN/u);
  assert.match(model, /emptyPublicCertificateVerification/u);
  assert.match(publicPage, /Сертификат не найден/u);
  for (const allowed of ["displayName", "courseTitle", "courseVersion", "issuedAt", "certificateCode", "VALID", "REVOKED"]) {
    assert.match(`${model}\n${publicPage}`, new RegExp(allowed, "u"));
  }
  assert.doesNotMatch(`${projection}\n${publicPage}`, /revocation_reason|email|user_uuid|quiz_attempt|project_submission_files|reviewer_id/iu);
});

test("Pass 2 historical boundary remains intact while Pass 3 opens only the visual layer", () => {
  const certificateMigrations = readdirSync(join(root, "supabase/migrations"))
    .filter((name) => name.includes("phase08m_certificate"));
  assert.deepEqual(certificateMigrations, ["20260810040000_phase08m_certificate_authority.sql"]);
  assert.equal(sha256("supabase/migrations/20260810040000_phase08m_certificate_authority.sql"), "4fd8d66b24f01b14b584f98169e74a0811d3703e666614ab6b04131bfa51a07b");
  for (const excluded of ["new_migration", "certificate_storage", "server_pdf", "qr_code", "email", "public_registry", "admin_certificate_ui"]) {
    assert.ok(authority.excluded.includes(excluded));
  }
  assert.match(scope, /functional semantic skeleton only/u);
  assert.match(visualScope, /owner-approved Canva composition/u);
  assert.equal(packageJson.dependencies.qrcode, "1.5.4");
  assert.equal(packageJson.devDependencies["@types/qrcode"], "1.5.6");
  assert.doesNotMatch(`${projection}\n${actions}`, /storage\.from|send_email|public registry|certificate admin/iu);
});

test("the owner visual gate now provides approved art, real QR, and one-page A4 browser PDF", () => {
  assert.match(visualScope, /PHASE08M_CERTIFICATE_VISUAL_DESIGN_GATE/u);
  assert.match(artwork, /IBM_Plex_Sans/u);
  assert.match(artwork, /QRCode\.toString/u);
  assert.match(artwork, /publicCertificatePath\(certificateCode\)/u);
  assert.match(artwork, /archstart-certificate-facade-background\.png/u);
  assert.match(printControl, /window\.print\(\)/u);
  assert.match(printControl, /Сохранить PDF/u);
  assert.match(css, /@page[\s\S]*size:\s*A4 landscape/iu);
  assert.match(css, /@media print/iu);
  assert.match(privatePage, /CertificatePrintControl/u);
  assert.match(publicPage, /CertificateArtwork/u);
});

test("certificate browser source contains no secret client, credential-shaped value, or private authority input", () => {
  const browserSource = `${issueControl}\n${dashboardCard}\n${privatePage}\n${publicPage}\n${printControl}`;
  assert.doesNotMatch(browserSource, /createSecretSupabaseClient|SUPABASE_SECRET_KEY|sb_secret_|sb_publishable_|BEGIN PRIVATE KEY/gu);
  assert.doesNotMatch(browserSource, /p_user_id|p_display_name|p_eligible|p_issued_at|p_certificate_code/gu);
});

test("Phase 07 progress, project, upload, review, Quiz, and accepted certificate authority files remain outside the Pass 2 implementation", () => {
  assert.equal(sha256("src/lib/supabase/database.types.ts"), "cec1018a1adfff0dc8784ae16b95bdbefbc61270a71170f5f24e29d0732a7b1f");
  assert.match(scope, /Project workflow, upload, review, Quiz and progress authority are not modified|application layer over the accepted certificate database authority/u);
  assert.doesNotMatch(`${actions}\n${projection}`, /submit_project|finalize_project|project_upload|quiz_answer|lesson_completion.*insert/iu);
});
