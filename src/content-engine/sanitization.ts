import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { promisify } from "node:util";
import type { SanitationRecord, SanitationWarning, SourceProvenance } from "./types.ts";
import { ZipArchive } from "./zip.ts";

const execFileAsync = promisify(execFile);
const LOCAL_PATH = /(?:\/mnt\/|file:\/\/|[A-Za-z]:\\|OneDrive)/i;
const PROMPT_MARKER = /(?:Nano Banana|请生成|画布规格|negative prompt|ARCH\.START example style:)/i;

export async function inspectForPublication(path: string, source: SourceProvenance): Promise<SanitationRecord> {
  const suffix = extname(path).toLowerCase();
  const result = suffix === ".docx" || suffix === ".pptx"
    ? await inspectOffice(path)
    : suffix === ".pdf"
      ? await inspectPdf(path)
      : suffix === ".png" || suffix === ".jpg" || suffix === ".jpeg"
        ? await inspectImage(path)
        : { details: {}, warnings: [] as SanitationWarning[] };
  return {
    source: { ...source, role: "SANITIZATION_INSPECTION" },
    inspectionMode: "NON_DESTRUCTIVE",
    publicationStatus: result.warnings.length > 0 ? "SANITIZATION_REQUIRED" : "AVAILABLE",
    details: result.details,
    warnings: result.warnings,
  };
}

async function inspectOffice(path: string): Promise<{ details: Record<string, unknown>; warnings: SanitationWarning[] }> {
  const archive = await ZipArchive.open(path);
  const names = archive.names();
  const textEntries = names.filter((name) => /\.(?:xml|rels)$/i.test(name));
  let combined = "";
  for (const name of textEntries) {
    try { combined += `\n${archive.text(name)}`; } catch { /* Binary relationship payloads are ignored. */ }
  }
  const core = archive.has("docProps/core.xml") ? archive.text("docProps/core.xml") : "";
  const app = archive.has("docProps/app.xml") ? archive.text("docProps/app.xml") : "";
  const authorFields = ["dc:creator", "cp:lastModifiedBy"].filter((field) => new RegExp(`<${field}[^>]*>\\s*[^<]+`, "i").test(core));
  const companyFields = ["Company", "Manager", "Template"].filter((field) => new RegExp(`<${field}[^>]*>\\s*[^<]+`, "i").test(app));
  const externalRelationships = [...combined.matchAll(/<Relationship\b[^>]*TargetMode=["']External["'][^>]*>/gi)];
  const comments = names.some((name) => /comments(?:Extended)?\.xml$/i.test(name));
  const speakerNotes = names.some((name) => /notesSlides\/notesSlide\d+\.xml$/i.test(name));
  const hiddenSlidesOrContent = /\bshow=["']0["']/i.test(combined) || /\bhidden=["'](?:1|true)["']/i.test(combined);
  const localPaths = LOCAL_PATH.test(combined);
  const canvaIdentifiers = /canva/i.test(combined);
  const embeddedProductionPrompts = PROMPT_MARKER.test(combined);
  const macrosOrActiveContent = names.some((name) => /(?:vbaProject\.bin|activeX\/|embeddings\/|oleObject)/i.test(name));
  const details = {
    authorMetadataFieldsPresent: authorFields,
    companyMetadataFieldsPresent: companyFields,
    comments,
    speakerNotes,
    hiddenSlidesOrContent,
    localOrOneDrivePaths: localPaths,
    externalRelationshipCount: externalRelationships.length,
    canvaIdentifiers,
    embeddedProductionPrompts,
    macrosOrActiveContent,
  };
  const warnings: SanitationWarning[] = [];
  if (authorFields.length || companyFields.length) warnings.push(warning("DOCUMENT_METADATA", "medium", "Document identity, company, manager, or template metadata requires review in a sanitized derivative."));
  if (comments) warnings.push(warning("COMMENTS_PRESENT", "high", "Document comments are present and must be reviewed or removed before publication."));
  if (speakerNotes) warnings.push(warning("SPEAKER_NOTES_PRESENT", "high", "Speaker notes are present; SRPT remains canonical and public derivatives require note removal."));
  if (hiddenSlidesOrContent) warnings.push(warning("HIDDEN_CONTENT", "high", "Hidden slide or content state requires review before publication."));
  if (localPaths) warnings.push(warning("LOCAL_PATH_REFERENCE", "high", "Local file-system or OneDrive references are present and must be sanitized."));
  if (externalRelationships.length) warnings.push(warning("EXTERNAL_RELATIONSHIP", "medium", "External Office relationships require explicit allowlist review."));
  if (canvaIdentifiers) warnings.push(warning("CANVA_IDENTIFIER", "medium", "Canva-related identifiers require metadata review."));
  if (embeddedProductionPrompts) warnings.push(warning("PRODUCTION_PROMPT", "critical", "Embedded production-prompt material must never enter public content."));
  if (macrosOrActiveContent) warnings.push(warning("ACTIVE_CONTENT", "critical", "Macros, OLE, ActiveX, or embedded active content requires rejection or controlled sanitation."));
  return { details, warnings };
}

async function inspectPdf(path: string): Promise<{ details: Record<string, unknown>; warnings: SanitationWarning[] }> {
  const raw = await readFile(path);
  const binaryText = raw.toString("latin1");
  let metadataFieldsPresent: string[] = [];
  let infoOutput = "";
  try {
    ({ stdout: infoOutput } = await execFileAsync("pdfinfo", [path], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }));
    const allowed = new Set(["Title", "Subject", "Keywords", "Author", "Creator", "Producer", "CreationDate", "ModDate", "Custom Metadata"]);
    metadataFieldsPresent = infoOutput.split(/\r?\n/).map((line) => line.split(":", 1)[0]!.trim()).filter((key) => allowed.has(key));
  } catch (error) {
    throw new Error(`PDF sanitation inspection requires pdfinfo: ${error instanceof Error ? error.message : String(error)}`);
  }
  const externalLinks = [...binaryText.matchAll(/\/URI\s*\(/g)].length;
  const activeContent = /\/(?:JavaScript|JS|Launch)\b/i.test(binaryText);
  const localPaths = LOCAL_PATH.test(infoOutput) || LOCAL_PATH.test(binaryText);
  const canvaIdentifiers = /canva/i.test(infoOutput) || /canva/i.test(binaryText);
  const details = { metadataFieldsPresent, externalLinkCount: externalLinks, javascriptOrActiveContent: activeContent, localOrOneDrivePaths: localPaths, canvaIdentifiers };
  const warnings: SanitationWarning[] = [];
  if (metadataFieldsPresent.length) warnings.push(warning("PDF_METADATA", "medium", "PDF metadata requires sanitation review."));
  if (externalLinks) warnings.push(warning("PDF_EXTERNAL_LINKS", "low", "PDF external links require explicit allowlist review."));
  if (activeContent) warnings.push(warning("PDF_ACTIVE_CONTENT", "critical", "PDF active content must be rejected or removed."));
  if (localPaths) warnings.push(warning("LOCAL_PATH_REFERENCE", "high", "Local file-system or OneDrive references are present and must be sanitized."));
  if (canvaIdentifiers) warnings.push(warning("CANVA_IDENTIFIER", "medium", "Canva-related identifiers require metadata review."));
  return { details, warnings };
}

async function inspectImage(path: string): Promise<{ details: Record<string, unknown>; warnings: SanitationWarning[] }> {
  const buffer = await readFile(path);
  const suffix = extname(path).toLowerCase();
  const metadataKeysPresent: string[] = [];
  let dimensions: { width: number; height: number; format: string } | null = null;
  let metadataText = "";
  if (suffix === ".png" && buffer.length >= 24 && buffer.subarray(1, 4).toString("ascii") === "PNG") {
    dimensions = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), format: "PNG" };
    let offset = 8;
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
      const data = buffer.subarray(offset + 8, offset + 8 + length);
      if (["tEXt", "iTXt", "zTXt", "eXIf", "pHYs"].includes(type)) {
        metadataKeysPresent.push(type);
        if (type !== "zTXt") metadataText += data.toString("utf8");
      }
      offset += 12 + length;
      if (type === "IEND") break;
    }
  } else if (suffix === ".jpg" || suffix === ".jpeg") {
    dimensions = parseJpegDimensions(buffer);
    metadataText = buffer.toString("latin1");
    if (/Exif\0\0/.test(metadataText)) metadataKeysPresent.push("EXIF");
    if (/http:\/\/ns\.adobe\.com\/xap/i.test(metadataText)) metadataKeysPresent.push("XMP");
  }
  const localPaths = LOCAL_PATH.test(metadataText);
  const canvaIdentifiers = /canva/i.test(metadataText);
  const details = { metadataKeysPresent: [...new Set(metadataKeysPresent)].sort(), localOrOneDrivePaths: localPaths, canvaIdentifiers, dimensions };
  const warnings: SanitationWarning[] = [];
  if (metadataKeysPresent.length) warnings.push(warning("IMAGE_METADATA", "medium", "Image metadata requires review before publication."));
  if (localPaths) warnings.push(warning("LOCAL_PATH_REFERENCE", "high", "Local file-system or OneDrive references are present and must be sanitized."));
  if (canvaIdentifiers) warnings.push(warning("CANVA_IDENTIFIER", "medium", "Canva-related identifiers require metadata review."));
  return { details, warnings };
}

function parseJpegDimensions(buffer: Buffer): { width: number; height: number; format: string } | null {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1]!;
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7), format: "JPEG" };
    offset += 2 + length;
  }
  return null;
}

function warning(code: string, severity: SanitationWarning["severity"], message: string): SanitationWarning {
  return { code, severity, message };
}
