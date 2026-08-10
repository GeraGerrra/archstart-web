import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let modulePromise: Promise<PdfJsModule> | null = null;

function installPdfJsNodeGlobals(): void {
  if (!("DOMMatrix" in globalThis)) {
    Object.defineProperty(globalThis, "DOMMatrix", { configurable: true, value: DOMMatrix, writable: true });
  }
  if (!("ImageData" in globalThis)) {
    Object.defineProperty(globalThis, "ImageData", { configurable: true, value: ImageData, writable: true });
  }
  if (!("Path2D" in globalThis)) {
    Object.defineProperty(globalThis, "Path2D", { configurable: true, value: Path2D, writable: true });
  }
}

export function loadPdfJsModule(): Promise<PdfJsModule> {
  installPdfJsNodeGlobals();
  modulePromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return modulePromise;
}
