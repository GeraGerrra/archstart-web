import type { MiniOutputRecord, SourceProvenance } from "./types.ts";

export const PUBLIC_MNOT_SECTION_ALIASES = Object.freeze({
  title: ["mini-output title", "mini output title", "название mini-output", "название мини-результата"],
  purpose: ["purpose", "цель"],
  status: ["status", "статус"],
  estimatedTime: ["estimated time", "time estimate", "время", "примерное время"],
  tools: ["tools", "инструменты"],
  studentTask: ["student task", "task", "задание студента", "задание"],
  ourExample: ["our example", "our example heading", "наш пример"],
  selfCheck: ["mini-output self-check", "mini output self check", "self-check", "self check", "самопроверка"],
} as const);

const INTERNAL_SECTION_ALIASES = [
  "our example png prompt",
  "our example image prompt",
  "nano banana prompt",
  "chinese generation instructions",
  "canvas specifications",
  "font instructions",
  "font-generation instructions",
  "negative prompt",
  "composition instructions",
  "internal production notes",
  "internal composition instructions",
] as const;

export const FORBIDDEN_MNOT_MARKERS = [
  "our example png prompt",
  "nano banana",
  "请生成",
  "画布规格",
  "字体要求",
  "negative prompt",
  "font-generation",
  "internal composition",
  "arch.start example style:",
  "1920x1080, 横向",
] as const;

type PublicSectionKey = keyof typeof PUBLIC_MNOT_SECTION_ALIASES;
type Boundary = { key: PublicSectionKey | "INTERNAL"; heading: string; lineIndex: number; numericPrefix: number | null };

function normalizeHeading(value: string): { normalized: string; numericPrefix: number | null } {
  const trimmed = value.trim();
  const prefix = /^(\d+)\s*[.)]\s*(.+)$/.exec(trimmed);
  const heading = prefix ? prefix[2]! : trimmed;
  return {
    normalized: heading.toLowerCase().replace(/[：:]+$/, "").replace(/[\s_-]+/g, " ").trim(),
    numericPrefix: prefix ? Number.parseInt(prefix[1]!, 10) : null,
  };
}

function classifyHeading(line: string): Boundary["key"] | null {
  const { normalized } = normalizeHeading(line);
  for (const [key, aliases] of Object.entries(PUBLIC_MNOT_SECTION_ALIASES) as Array<[PublicSectionKey, readonly string[]]>) {
    if (aliases.some((alias) => normalized === alias)) return key;
  }
  if (INTERNAL_SECTION_ALIASES.some((alias) => normalized === alias || normalized.startsWith(`${alias} `))) return "INTERNAL";
  return null;
}

export interface MnotExclusionItem {
  lessonCode: string;
  sourceFile: string;
  detectedBoundaries: Array<{ heading: string; key: string; line: number; numericPrefix: number | null }>;
  includedPublicSections: string[];
  excludedInternalSections: string[];
  forbiddenMarkerLeaks: string[];
  result: "PASS" | "FAIL";
}

export function containsForbiddenProductionContent(value: unknown): boolean {
  const serialized = JSON.stringify(value).toLowerCase();
  return FORBIDDEN_MNOT_MARKERS.some((marker) => serialized.includes(marker.toLowerCase()));
}

export function parseMiniOutput(
  text: string,
  lessonCode: string,
  sourceFile: string,
  source: SourceProvenance,
): { record: MiniOutputRecord; report: MnotExclusionItem } {
  const lines = text.split("\n");
  const boundaries: Boundary[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const key = classifyHeading(lines[lineIndex]!);
    if (!key) continue;
    const normalized = normalizeHeading(lines[lineIndex]!);
    boundaries.push({ key, heading: normalized.normalized, lineIndex, numericPrefix: normalized.numericPrefix });
  }
  if (boundaries.length === 0) throw new Error(`${sourceFile}: no reviewed MNOT section boundaries found.`);

  const sections = new Map<PublicSectionKey, string[]>();
  const excludedInternalSections: string[] = [];
  for (let index = 0; index < boundaries.length; index += 1) {
    const boundary = boundaries[index]!;
    const body = lines.slice(boundary.lineIndex + 1, boundaries[index + 1]?.lineIndex ?? lines.length).join("\n").trim();
    if (boundary.key === "INTERNAL") {
      excludedInternalSections.push(boundary.heading);
      continue;
    }
    if (sections.has(boundary.key)) throw new Error(`${sourceFile}: duplicate public MNOT section ${boundary.key}.`);
    sections.set(boundary.key, body ? body.split("\n").map((line) => line.trim()).filter(Boolean) : []);
  }

  const required: PublicSectionKey[] = ["title", "purpose", "status", "estimatedTime", "tools", "studentTask", "ourExample", "selfCheck"];
  for (const key of required) if (!sections.has(key)) throw new Error(`${sourceFile}: required public MNOT section ${key} is absent.`);

  const titleLines = sections.get("title")!;
  const titleRuLine = titleLines.find((line) => /^RU:\s*/i.test(line));
  const titleEn = titleLines.find((line) => !/^RU:\s*/i.test(line)) ?? null;
  const titleRu = titleRuLine ? titleRuLine.replace(/^RU:\s*/i, "").trim() : null;
  const taskLines = sections.get("studentTask")!;
  const stepsIndex = taskLines.findIndex((line) => /^(?:steps|шаги)\s*:?$/i.test(line));
  const taskText = (stepsIndex >= 0 ? taskLines.slice(0, stepsIndex) : taskLines.slice(0, 1)).join("\n").trim();
  const stepLines = stepsIndex >= 0 ? taskLines.slice(stepsIndex + 1) : taskLines.slice(1);

  const record: MiniOutputRecord = {
    title: { en: titleEn, ru: titleRu },
    purpose: sections.get("purpose")!.join("\n"),
    status: sections.get("status")!.join("\n"),
    estimatedTime: sections.get("estimatedTime")!.join("\n"),
    tools: sections.get("tools")!,
    studentTask: taskText,
    orderedSteps: stepLines.map((step, index) => ({ order: index + 1, text: step.replace(/^\d+[.)]\s*/, "") })),
    ourExampleHeading: boundaries.find((boundary) => boundary.key === "ourExample")?.heading.replace(/\b\w/g, (char) => char.toUpperCase()).replace("Our Example", "Our example") ?? "Our example",
    selfCheck: sections.get("selfCheck")!,
    source,
  };

  const serialized = JSON.stringify(record).toLowerCase();
  const forbiddenMarkerLeaks = FORBIDDEN_MNOT_MARKERS.filter((marker) => serialized.includes(marker.toLowerCase()));
  const report: MnotExclusionItem = {
    lessonCode,
    sourceFile,
    detectedBoundaries: boundaries.map((boundary) => ({
      heading: boundary.heading,
      key: boundary.key,
      line: boundary.lineIndex + 1,
      numericPrefix: boundary.numericPrefix,
    })),
    includedPublicSections: boundaries.filter((boundary) => boundary.key !== "INTERNAL").map((boundary) => boundary.key),
    excludedInternalSections,
    forbiddenMarkerLeaks,
    result: forbiddenMarkerLeaks.length === 0 && excludedInternalSections.length > 0 ? "PASS" : "FAIL",
  };
  if (report.result !== "PASS") throw new Error(`${sourceFile}: MNOT public-content boundary validation failed: ${forbiddenMarkerLeaks.join(", ") || "no internal section boundary detected"}.`);
  return { record, report };
}
