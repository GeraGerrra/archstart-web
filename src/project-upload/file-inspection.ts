import { createHash } from "node:crypto";
import { getDocument, VerbosityLevel } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  PROJECT_FILE_FINALIZATION_LIMITS,
  type ProjectFileInspection,
  type ProjectFilePolicySnapshot,
  type ProjectFilePolicyValidation,
} from "./finalization-types.ts";

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PDF_SIGNATURE = Uint8Array.from([37, 80, 68, 70, 45]);
const IHDR_TYPE = Uint8Array.from([73, 72, 68, 82]);

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.byteLength < prefix.byteLength) return false;
  return prefix.every((value, index) => bytes[index] === value);
}

function uint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000)
    + ((bytes[offset + 1] ?? 0) << 16)
    + ((bytes[offset + 2] ?? 0) << 8)
    + (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validPngBitDepth(bitDepth: number, colorType: number): boolean {
  if (colorType === 0) return [1, 2, 4, 8, 16].includes(bitDepth);
  if (colorType === 3) return [1, 2, 4, 8].includes(bitDepth);
  if ([2, 4, 6].includes(colorType)) return [8, 16].includes(bitDepth);
  return false;
}

function inspectPngHeader(bytes: Uint8Array):
  | { ok: true; width: number; height: number }
  | { ok: false } {
  if (bytes.byteLength < 33 || !startsWith(bytes, PNG_SIGNATURE)) {
    return { ok: false };
  }
  if (uint32(bytes, 8) !== 13 || !startsWith(bytes.subarray(12, 16), IHDR_TYPE)) {
    return { ok: false };
  }

  const width = uint32(bytes, 16);
  const height = uint32(bytes, 20);
  const bitDepth = bytes[24] ?? -1;
  const colorType = bytes[25] ?? -1;
  const compression = bytes[26] ?? -1;
  const filter = bytes[27] ?? -1;
  const interlace = bytes[28] ?? -1;
  const expectedCrc = uint32(bytes, 29);
  const actualCrc = crc32(bytes.subarray(12, 29));

  if (
    width < 1
    || height < 1
    || !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || !validPngBitDepth(bitDepth, colorType)
    || compression !== 0
    || filter !== 0
    || ![0, 1].includes(interlace)
    || expectedCrc !== actualCrc
  ) {
    return { ok: false };
  }
  return { ok: true, width, height };
}

function isEncryptedPdfError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  const code = "code" in error && typeof error.code === "number" ? error.code : null;
  return name === "PasswordException" || code === 1 || code === 2;
}

async function inspectPdfPageCount(bytes: Uint8Array): Promise<
  | { ok: true; pageCount: number }
  | { ok: false; encryptedOrUnsupported: boolean }
> {
  try {
    const loadingTask = getDocument({
      data: Uint8Array.from(bytes),
      stopAtErrors: true,
      useSystemFonts: false,
      verbosity: VerbosityLevel.ERRORS,
    });
    try {
      const document = await loadingTask.promise;
      if (!Number.isSafeInteger(document.numPages) || document.numPages < 1) {
        return { ok: false, encryptedOrUnsupported: false };
      }
      return { ok: true, pageCount: document.numPages };
    } finally {
      await loadingTask.destroy().catch(() => undefined);
    }
  } catch (error) {
    return { ok: false, encryptedOrUnsupported: isEncryptedPdfError(error) };
  }
}

export async function inspectProjectFile(bytes: Uint8Array): Promise<ProjectFileInspection> {
  if (
    bytes.byteLength < PROJECT_FILE_FINALIZATION_LIMITS.minimumBytes
    || bytes.byteLength > PROJECT_FILE_FINALIZATION_LIMITS.maximumBytes
  ) {
    return { ok: false, reason: "object_size_out_of_bounds" };
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (startsWith(bytes, PNG_SIGNATURE)) {
    const png = inspectPngHeader(bytes);
    if (!png.ok) return { ok: false, reason: "malformed_png" };
    return {
      ok: true,
      detectedMime: "image/png",
      sizeBytes: bytes.byteLength,
      sha256,
      pageCount: null,
      pixelWidth: png.width,
      pixelHeight: png.height,
    };
  }

  if (startsWith(bytes, PDF_SIGNATURE)) {
    const pdf = await inspectPdfPageCount(bytes);
    if (!pdf.ok) {
      return {
        ok: false,
        reason: pdf.encryptedOrUnsupported
          ? "encrypted_or_unsupported_pdf"
          : "malformed_pdf",
      };
    }
    return {
      ok: true,
      detectedMime: "application/pdf",
      sizeBytes: bytes.byteLength,
      sha256,
      pageCount: pdf.pageCount,
      pixelWidth: null,
      pixelHeight: null,
    };
  }

  return { ok: false, reason: "unsupported_actual_mime" };
}

export function validateProjectFilePolicy(
  inspection: Extract<ProjectFileInspection, { ok: true }>,
  policy: ProjectFilePolicySnapshot,
): ProjectFilePolicyValidation {
  if (inspection.sizeBytes !== policy.declaredSizeBytes) {
    return { ok: false, reason: "declared_size_mismatch" };
  }
  if (
    inspection.sizeBytes < PROJECT_FILE_FINALIZATION_LIMITS.minimumBytes
    || inspection.sizeBytes > policy.maxFileBytes
    || inspection.sizeBytes > PROJECT_FILE_FINALIZATION_LIMITS.maximumBytes
  ) {
    return { ok: false, reason: "frozen_policy_mismatch" };
  }
  if (inspection.detectedMime !== policy.declaredMime) {
    return { ok: false, reason: "declared_mime_mismatch" };
  }
  if (!policy.allowedMimeTypes.includes(inspection.detectedMime)) {
    return { ok: false, reason: "frozen_policy_mismatch" };
  }

  if (inspection.detectedMime === "image/png") {
    if (
      policy.formatType !== "SINGLE_BOARD"
      || inspection.pageCount !== null
      || inspection.pixelWidth !== policy.expectedWidth
      || inspection.pixelHeight !== policy.expectedHeight
    ) {
      return { ok: false, reason: "invalid_png_dimensions" };
    }
    return { ok: true };
  }

  if (
    inspection.pixelWidth !== null
    || inspection.pixelHeight !== null
    || inspection.pageCount === null
    || inspection.pageCount < policy.minPageCount
    || inspection.pageCount > policy.maxPageCount
  ) {
    return { ok: false, reason: "invalid_pdf_page_count" };
  }
  return { ok: true };
}
