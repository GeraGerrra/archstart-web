import type { SourceProvenance, TranscriptRecord, TranscriptSection } from "./types.ts";

export function parseTranscript(text: string, canonicalFile: string, source: SourceProvenance): TranscriptRecord {
  const matches = [...text.matchAll(/^(S\d{2}):\s*$/gm)];
  if (matches.length === 0) throw new Error(`${canonicalFile}: canonical SRPT contains no Sxx sections.`);
  const sections: TranscriptSection[] = matches.map((match, index) => ({
    id: match[1] as `S${number}`,
    order: index + 1,
    text: text.slice(match.index! + match[0].length, matches[index + 1]?.index ?? text.length).trim(),
  }));
  for (let index = 0; index < sections.length; index += 1) {
    const expected = `S${String(index + 1).padStart(2, "0")}`;
    if (sections[index]!.id !== expected) throw new Error(`${canonicalFile}: expected transcript section ${expected}, found ${sections[index]!.id}.`);
    if (!sections[index]!.text) throw new Error(`${canonicalFile}: transcript section ${expected} is empty.`);
  }
  return { canonicalFile, sections, sectionCount: sections.length, source };
}
