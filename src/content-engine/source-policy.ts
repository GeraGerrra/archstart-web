import type { ContentStatus } from "./status.ts";

export interface Classification {
  status: ContentStatus;
  classification: "LESSON_ALLOWLIST" | "PROJECT_ALLOWLIST" | "EXPLICIT_ALIAS" | "EXCLUDED_POLICY" | "UNKNOWN";
  role?: string;
  contentCode?: string;
  canonicalPublicFilename?: string;
  reason?: string;
}

export interface ExplicitAliasDefinition {
  canonicalCode: string;
  canonicalRole: "STUDENT_PAGE" | "EXAMPLE_PPTX";
  canonicalPublicFilename: string;
  reason: string;
}

const LESSON = /^(M\d{2}_L\d{2})_(PRES\.pptx|SRPT\.txt|VOCB\.pdf|MNOT\.txt|PICE\.png)$/i;
const PROJECT_PAGE = /^ARCH\.START_(M\d{2})_Project(\d{2})_Student_Page\.docx$/i;
const PROJECT_PPTX = /^(M\d{2})_P(\d{2})_PPTX\.pptx$/i;
const PROJECT_PREVIEW = /^(M\d{2})_P(\d{2})_(?:PREVIEW|BOARD)\.(?:png|jpg|jpeg)$/i;

export const EXPLICIT_ALIASES = Object.freeze({
  "ARCH.START_M01_Project01_Student_Page_V2.docx": {
    canonicalCode: "M01_P01",
    canonicalRole: "STUDENT_PAGE",
    canonicalPublicFilename: "ARCH.START_M01_Project01_Student_Page.docx",
    reason: "Explicit Phase 01 source registration for the intentionally supplied approved M01 Student Page revision.",
  },
  "ARCH.START_M03_Project03_Student_Page (1).docx": {
    canonicalCode: "M03_P03",
    canonicalRole: "STUDENT_PAGE",
    canonicalPublicFilename: "ARCH.START_M03_Project03_Student_Page.docx",
    reason: "Approved Phase 00 V4 audit-sample alias.",
  },
  "M03_P03_PPTX (1).pptx": {
    canonicalCode: "M03_P03",
    canonicalRole: "EXAMPLE_PPTX",
    canonicalPublicFilename: "M03_P03_PPTX.pptx",
    reason: "Approved Phase 00 V4 audit-sample alias.",
  },
} satisfies Readonly<Record<string, ExplicitAliasDefinition>>);

export function classifyFileName(fileName: string): Classification {
  const alias = EXPLICIT_ALIASES[fileName as keyof typeof EXPLICIT_ALIASES];
  if (alias) return {
    status: "ALIAS_RESOLVED",
    classification: "EXPLICIT_ALIAS",
    role: alias.canonicalRole,
    contentCode: alias.canonicalCode,
    canonicalPublicFilename: alias.canonicalPublicFilename,
    reason: alias.reason,
  };
  const lesson = LESSON.exec(fileName);
  if (lesson) return {
    status: "AVAILABLE",
    classification: "LESSON_ALLOWLIST",
    role: lesson[2]!.split(".")[0]!.toUpperCase(),
    contentCode: lesson[1]!.toUpperCase(),
  };
  const page = PROJECT_PAGE.exec(fileName);
  if (page) return { status: "AVAILABLE", classification: "PROJECT_ALLOWLIST", role: "STUDENT_PAGE", contentCode: `${page[1]!.toUpperCase()}_P${page[2]}` };
  const pptx = PROJECT_PPTX.exec(fileName);
  if (pptx) return { status: "AVAILABLE", classification: "PROJECT_ALLOWLIST", role: "EXAMPLE_PPTX", contentCode: `${pptx[1]!.toUpperCase()}_P${pptx[2]}` };
  const preview = PROJECT_PREVIEW.exec(fileName);
  if (preview) return { status: "AVAILABLE", classification: "PROJECT_ALLOWLIST", role: "PREVIEW_IMAGE", contentCode: `${preview[1]!.toUpperCase()}_P${preview[2]}` };
  if (/INFO\.docx$/i.test(fileName)) return { status: "IGNORED_BY_POLICY", classification: "EXCLUDED_POLICY", reason: "INFO is intentionally excluded by the clean lesson allowlist." };
  if (/Internal[_ ]Package/i.test(fileName)) return { status: "IGNORED_BY_POLICY", classification: "EXCLUDED_POLICY", reason: "Internal Production Packages are excluded from every public and app-connected boundary." };
  if (/OEXA/i.test(fileName)) return { status: "IGNORED_BY_POLICY", classification: "EXCLUDED_POLICY", reason: "OEXA is excluded by the clean project allowlist." };
  if (/\.mp4$/i.test(fileName)) return { status: "IGNORED_BY_POLICY", classification: "EXCLUDED_POLICY", reason: "MP4 is prohibited; public video is hosted on YouTube." };
  if (/^m\d{2}full/i.test(fileName)) return { status: "IGNORED_BY_POLICY", classification: "EXCLUDED_POLICY", reason: "Combined module booklet cannot replace individual lesson content or PICE." };
  if (fileName === "ARCHSTART_SITE_PHASE_00_V4.zip") return { status: "IGNORED_BY_POLICY", classification: "EXCLUDED_POLICY", reason: "Governing specification evidence is never ingested as public course content." };
  return { status: "IGNORED_BY_POLICY", classification: "UNKNOWN", reason: "Default-deny: no approved role or exact alias." };
}
