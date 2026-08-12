import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { certificateNameLayout } from "../src/certificate/name-layout.ts";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const bytes = (path: string): Buffer => readFileSync(join(root, path));
const sha256 = (path: string): string => createHash("sha256").update(bytes(path)).digest("hex");

const artwork = read("src/certificate/CertificateArtwork.tsx");
const privatePage = read("src/certificate/PrivateCertificatePage.tsx");
const publicPage = read("src/certificate/PublicCertificateVerificationPage.tsx");
const printControl = read("src/certificate/CertificatePrintControl.tsx");
const model = read("src/certificate/model.ts");
const css = read("app/globals.css");
const scope = read("PHASE08M_CERTIFICATE_VISUAL_DESIGN.md");
const authority = JSON.parse(read("PHASE08M_CERTIFICATE_VISUAL_DESIGN_V1.json")) as {
  acceptedBase: { gitHead: string; gitTree: string };
  ownerVisualGate: {
    result: string;
    backgroundPath: string;
    backgroundSha256: string;
    backgroundWidth: number;
    backgroundHeight: number;
  };
  qr: { dependency: string; privateDataIncluded: boolean };
  preservedAuthority: Record<string, boolean>;
};

function pngDimensions(path: string): { width: number; height: number } {
  const file = bytes(path);
  assert.equal(file.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(file.subarray(12, 16).toString("ascii"), "IHDR");
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
}

test("Pass 3 is pinned to the accepted Pass 2 source", () => {
  assert.equal(authority.acceptedBase.gitHead, "78b00596918c746ee5faaee75bd16e8e78989af3");
  assert.equal(authority.acceptedBase.gitTree, "d3f28631571a9503493325d7953ec81688218d8b");
  assert.equal(authority.ownerVisualGate.result, "OPENED_BY_OWNER_APPROVED_DESIGN");
  assert.match(scope, /positive-QA fixture cleanup: accepted/u);
});

test("the owner-approved background is byte-exact and has the approved A4-like canvas", () => {
  const path = authority.ownerVisualGate.backgroundPath;
  assert.equal(path, "public/certificate-assets/archstart-certificate-facade-background.png");
  assert.equal(sha256(path), authority.ownerVisualGate.backgroundSha256);
  assert.deepEqual(pngDimensions(path), {
    width: authority.ownerVisualGate.backgroundWidth,
    height: authority.ownerVisualGate.backgroundHeight,
  });
  assert.equal(authority.ownerVisualGate.backgroundSha256, "4e4a122394699ff6ef5595e8db3d29a97c57d77b8e839acd5332ddad43905f86");
  assert.match(artwork, /const BACKGROUND_PATH = "\/certificate-assets\/archstart-certificate-facade-background\.png"/u);
  assert.doesNotMatch(artwork, /\/prototype-assets\//u);
});

test("the approved composition uses IBM Plex Sans and real dynamic certificate fields", () => {
  assert.match(artwork, /IBM_Plex_Sans/u);
  assert.match(artwork, /weight:\s*\["400", "500"\]/u);
  assert.match(artwork, /certificateCode/u);
  assert.match(artwork, /courseVersion/u);
  assert.match(artwork, /displayName/u);
  assert.match(artwork, /issuedAt/u);
  assert.match(artwork, /Сертификат о завершении курса/u);
  assert.match(artwork, /Certificate of Completion/u);
  assert.match(artwork, /ARCH\.START — русскоязычный вводный/u);
  assert.match(artwork, /не является государственной аккредитацией/u);
});

test("top certificate information matches the owner-approved restrained scale", () => {
  assert.match(css, /\.asa-certificate-artwork__identity p \{[^}]*margin-top:\s*2\.12cqw;[^}]*font-size:\s*1\.72cqw;/u);
  assert.match(css, /\.asa-certificate-artwork__metadata dt, \.asa-certificate-artwork__metadata dd \{[^}]*font-size:\s*1\.72cqw;/u);
  assert.doesNotMatch(css, /\.asa-certificate-artwork__identity p \{[^}]*margin-top:\s*1\.58cqw/u);
  assert.doesNotMatch(css, /\.asa-certificate-artwork__identity p \{[^}]*font-size:\s*2\.18cqw/u);
  assert.doesNotMatch(css, /\.asa-certificate-artwork__metadata dt, \.asa-certificate-artwork__metadata dd \{[^}]*font-size:\s*2\.18cqw/u);
});

test("name layout preserves first plus last name and scales deterministically", () => {
  assert.deepEqual(certificateNameLayout("Алина Сатанова"), {
    lines: ["Алина", "Сатанова"],
    scale: "standard",
    fontSizeCqw: 9.9,
  });
  assert.deepEqual(certificateNameLayout("Анна-Мария Александрова-Станиславская").lines, [
    "Анна-Мария",
    "Александрова-Станиславская",
  ]);
  const longName = certificateNameLayout("Анна-Мария Александрова-Станиславская");
  assert.equal(longName.scale, "extra-long");
  assert.ok(longName.fontSizeCqw < 4.2);
  assert.match(read("src/certificate/name-layout.ts"), /tokens\.length === 2/u);
  assert.match(artwork, /--asa-certificate-name-size/u);
  assert.match(css, /font-size:\s*var\(--asa-certificate-name-size/u);
  assert.doesNotMatch(`${model}\n${artwork}`, /patronymic|middle_name|отчество/iu);
});

test("QR encodes only the absolute public verification URL", () => {
  assert.equal(authority.qr.dependency, "qrcode@1.5.4");
  assert.equal(authority.qr.privateDataIncluded, false);
  assert.match(artwork, /QRCode\.toString\(url/u);
  assert.match(artwork, /errorCorrectionLevel:\s*"M"/u);
  assert.match(artwork, /new URL\(publicCertificatePath\(certificateCode\), `\$\{getSiteOrigin\(\)\}\/`\)/u);
  assert.doesNotMatch(artwork, /userId|user_id|email|project|reviewer|revocationReason/iu);
});

test("private and public issued surfaces share one artwork and truthful revocation overlay", () => {
  assert.match(privatePage, /CertificateArtwork/u);
  assert.match(publicPage, /CertificateArtwork/u);
  assert.match(privatePage, /status=\{revoked \? "REVOKED" : "VALID"\}/u);
  assert.match(publicPage, /status=\{revoked \? "REVOKED" : "VALID"\}/u);
  assert.match(artwork, /ОТОЗВАН/u);
  assert.match(artwork, /REVOKED/u);
});

test("browser PDF removes all non-certificate layout and prints one A4 landscape page", () => {
  assert.match(printControl, /^"use client";/u);
  assert.match(printControl, /window\.print\(\)/u);
  assert.match(css, /@page\s*\{[\s\S]*size:\s*A4 landscape;[\s\S]*margin:\s*0;/u);
  assert.match(css, /@media print[\s\S]*\.asa > :not\(main\)[\s\S]*display:\s*none/u);
  assert.match(css, /@media print[\s\S]*#asa-main[\s\S]*display:\s*contents/u);
  assert.match(css, /\.asa-certificate-page > :not\(\.asa-certificate-print-root\)[\s\S]*display:\s*none/u);
  assert.match(css, /\.asa-public-certificate-page > :not\(\.asa-certificate-print-root\)[\s\S]*display:\s*none/u);
  assert.match(css, /\.asa-certificate-print-root[\s\S]*position:\s*relative/u);
  assert.match(css, /\.asa-certificate-print-root[\s\S]*break-inside:\s*avoid-page/u);
  assert.match(css, /\.asa-certificate-print-root[\s\S]*width:\s*297mm/u);
  assert.match(css, /\.asa-certificate-artwork[\s\S]*height:\s*210mm/u);
  assert.doesNotMatch(css, /@media print[\s\S]*visibility:\s*hidden/u);
  assert.doesNotMatch(css, /@media print[\s\S]*position:\s*fixed/u);
  assert.doesNotMatch(`${artwork}\n${printControl}`, /serverPdf|pdfjs|storage\.from|upload/u);
});

test("the visual pass does not widen the accepted certificate authority", () => {
  assert.equal(authority.preservedAuthority.databaseMigrationAdded, false);
  assert.equal(authority.preservedAuthority.storageAdded, false);
  assert.equal(authority.preservedAuthority.certificateRpcChanged, false);
  assert.equal(authority.preservedAuthority.publicDisclosureChanged, false);
  assert.equal(authority.preservedAuthority.phase09Started, false);
  assert.match(scope, /does not add:[\s\S]*database migration/u);
});
