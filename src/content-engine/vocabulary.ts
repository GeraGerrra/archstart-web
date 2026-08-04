import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { VocabularyEntry } from "./types.ts";

const execFileAsync = promisify(execFile);

interface PdfWord {
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
}

export interface VocabularyExtractionResult {
  entries: VocabularyEntry[];
  warnings: string[];
  extractor: "pdftotext-tsv";
}

export async function assertVocabularyExtractorAvailable(): Promise<void> {
  try {
    await execFileAsync("pdftotext", ["-v"], { encoding: "utf8" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderr = typeof (error as { stderr?: unknown }).stderr === "string" ? (error as { stderr: string }).stderr : "";
    if (!message.includes("exit code 0") && !stderr.includes("pdftotext")) {
      throw new Error(`VOCB extraction requires the documented Poppler pdftotext command: ${message}`);
    }
  }
}

export async function extractVocabulary(pdfPath: string, sourceName: string): Promise<VocabularyExtractionResult> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("pdftotext", ["-tsv", pdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }));
  } catch (error) {
    throw new Error(`${sourceName}: pdftotext -tsv failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const words = parseTsv(stdout);
  if (words.length === 0) throw new Error(`${sourceName}: vocabulary PDF produced no extractable words.`);
  const pages = new Map<number, PdfWord[]>();
  for (const word of words) {
    const pageWords = pages.get(word.page) ?? [];
    pageWords.push(word);
    pages.set(word.page, pageWords);
  }

  const entries: VocabularyEntry[] = [];
  const warnings: string[] = [];
  for (const [page, pageWords] of [...pages.entries()].sort(([a], [b]) => a - b)) {
    const numberWords = pageWords
      .filter((word) => word.left < 65 && word.top > 70 && /^\d{1,2}$/.test(word.text))
      .map((word) => ({ ...word, number: Number.parseInt(word.text, 10) }))
      .filter((word) => word.number >= 1 && word.number <= 99)
      .sort((a, b) => a.top - b.top || a.left - b.left);

    for (let index = 0; index < numberWords.length; index += 1) {
      const numberWord = numberWords[index]!;
      const startTop = numberWord.top - 12;
      const endTop = (numberWords[index + 1]?.top ?? 842) - 12;
      const region = pageWords.filter((word) => word.top >= startTop && word.top < endTop);
      const enLabel = findLabel(region, (word) => /^EN:?$/i.test(word.text));
      const ruLabel = findLabel(region, (word) => /^RU:?$/i.test(word.text));
      const contextLabel = findLabel(region, (word) => /^CONTEXT$/i.test(word.text));
      const definitionLabel = findLabel(region, (word) => /^DEFINITION:?$/i.test(word.text));
      if (!enLabel || !ruLabel || !contextLabel || !definitionLabel) {
        warnings.push(`${sourceName}: uncertain label geometry for entry ${numberWord.number} on page ${page}`);
        continue;
      }

      const usable = region.filter((word) => {
        if (/^\d{1,2}$/.test(word.text)) return false;
        const sameLine = (a: PdfWord, b: PdfWord): boolean => Math.abs(a.top - b.top) < 1.2;
        if (sameLine(word, enLabel) && Math.abs(word.left - enLabel.left) < 1.5 && /^EN:?$/i.test(word.text)) return false;
        if (sameLine(word, ruLabel) && Math.abs(word.left - ruLabel.left) < 1.5 && /^RU:?$/i.test(word.text)) return false;
        if (sameLine(word, contextLabel) && word.left >= contextLabel.left - 1 && /^(?:CONTEXT|EXAMPLE):?$/i.test(word.text)) return false;
        if (sameLine(word, definitionLabel) && Math.abs(word.left - definitionLabel.left) < 1.5 && /^DEFINITION:?$/i.test(word.text)) return false;
        return true;
      });
      const termBottom = definitionLabel.top - 1;
      const termEn = joinWords(usable.filter((word) => word.left >= enLabel.left && word.left < ruLabel.left - 1 && word.top >= enLabel.top - 1 && word.top < termBottom));
      const termRu = joinWords(usable.filter((word) => word.left >= ruLabel.left - 1 && word.left < contextLabel.left - 1 && word.top >= ruLabel.top - 1 && word.top < termBottom));
      const contextExample = joinWords(usable.filter((word) => word.left >= contextLabel.left - 1 && word.top >= contextLabel.top - 1));
      const definition = joinWords(usable.filter((word) => word.left < contextLabel.left - 1 && word.top > definitionLabel.top + 2));
      if (!termEn || !termRu || !definition || !contextExample) {
        warnings.push(`${sourceName}: uncertain extraction for entry ${numberWord.number} on page ${page}`);
      }
      entries.push({
        number: numberWord.number,
        termEn,
        termRu,
        definition,
        contextExample,
        sourcePage: page,
        visualDescription: null,
      });
    }
  }

  const byNumber = new Map<number, VocabularyEntry>();
  for (const entry of entries) {
    if (byNumber.has(entry.number)) warnings.push(`${sourceName}: duplicate vocabulary number ${entry.number}`);
    else byNumber.set(entry.number, entry);
  }
  const ordered = [...byNumber.values()].sort((a, b) => a.number - b.number);
  const expected = ordered.map((_, index) => index + 1);
  if (ordered.some((entry, index) => entry.number !== expected[index])) warnings.push(`${sourceName}: vocabulary numbers are not contiguous from 1.`);
  return { entries: ordered, warnings, extractor: "pdftotext-tsv" };
}

function parseTsv(tsv: string): PdfWord[] {
  const rows = tsv.split(/\r?\n/);
  const header = rows.shift()?.split("\t") ?? [];
  const index = Object.fromEntries(header.map((field, position) => [field, position])) as Record<string, number>;
  for (const required of ["level", "page_num", "left", "top", "width", "height", "text"]) {
    if (index[required] == null) throw new Error(`pdftotext TSV is missing column ${required}.`);
  }
  const words: PdfWord[] = [];
  for (const row of rows) {
    if (!row) continue;
    const values = row.split("\t");
    if (values[index.level!] !== "5") continue;
    const text = values.slice(index.text!).join("\t").trim();
    if (!text || text.startsWith("###")) continue;
    words.push({
      page: Number.parseInt(values[index.page_num!]!, 10),
      left: Number.parseFloat(values[index.left!]!),
      top: Number.parseFloat(values[index.top!]!),
      width: Number.parseFloat(values[index.width!]!),
      height: Number.parseFloat(values[index.height!]!),
      text,
    });
  }
  return words;
}

function findLabel(words: PdfWord[], predicate: (word: PdfWord) => boolean): PdfWord | null {
  return words.filter(predicate).sort((a, b) => a.top - b.top || a.left - b.left)[0] ?? null;
}

function joinWords(words: PdfWord[]): string {
  return words
    .sort((a, b) => Math.abs(a.top - b.top) < 0.8 ? a.left - b.left : a.top - b.top)
    .map((word) => word.text)
    .join(" ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
