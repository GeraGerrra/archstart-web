import type { NormalizedProjectContent, SourceProvenance } from "./types.ts";
import { xmlAttribute, xmlText } from "./xml.ts";
import { ZipArchive } from "./zip.ts";

export async function parseStudentPageDocx(path: string, source: SourceProvenance): Promise<NormalizedProjectContent> {
  const archive = await ZipArchive.open(path);
  if (!archive.has("word/document.xml")) throw new Error(`${source.relativePath}: DOCX has no word/document.xml.`);
  const documentXml = archive.text("word/document.xml");
  const styleMap = archive.has("word/styles.xml") ? parseStyleMap(archive.text("word/styles.xml")) : new Map<string, string>();
  const body = /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/.exec(documentXml)?.[1];
  if (!body) throw new Error(`${source.relativePath}: DOCX body could not be parsed.`);

  const blocks: NormalizedProjectContent["blocks"] = [];
  const topLevel = [...body.matchAll(/<w:p\b[\s\S]*?<\/w:p>|<w:tbl\b[\s\S]*?<\/w:tbl>/g)].map((match) => match[0]);
  for (let index = 0; index < topLevel.length; index += 1) {
    const fragment = topLevel[index]!;
    const order = index + 1;
    if (fragment.startsWith("<w:p")) {
      const text = normalizeBlockText(xmlText(fragment));
      if (!text) continue;
      const properties = /<w:pPr\b[\s\S]*?<\/w:pPr>/.exec(fragment)?.[0] ?? "";
      const styleElement = /<w:pStyle\b[^>]*\/?\s*>/.exec(properties)?.[0] ?? "";
      const styleId = styleElement ? xmlAttribute(styleElement, "w:val") : null;
      blocks.push({ order, type: "paragraph", style: styleId ? styleMap.get(styleId) ?? styleId : "Normal", text });
      continue;
    }
    const rows = [...fragment.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((rowMatch) =>
      [...rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((cellMatch) => {
        const paragraphs = [...cellMatch[0].matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
          .map((paragraph) => normalizeBlockText(xmlText(paragraph[0])))
          .filter(Boolean);
        return paragraphs.join("\n");
      }),
    );
    if (rows.some((row) => row.some(Boolean))) blocks.push({ order, type: "table", rows });
  }
  if (blocks.length === 0) throw new Error(`${source.relativePath}: Student Page parser produced no public blocks.`);
  return { blocks, blockCount: blocks.length, source };
}

function parseStyleMap(xml: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of xml.matchAll(/<w:style\b[^>]*>[\s\S]*?<\/w:style>/g)) {
    const opening = /^<w:style\b[^>]*>/.exec(match[0])?.[0] ?? "";
    const id = xmlAttribute(opening, "w:styleId");
    const nameElement = /<w:name\b[^>]*\/?\s*>/.exec(match[0])?.[0] ?? "";
    const name = nameElement ? xmlAttribute(nameElement, "w:val") : null;
    if (id && name) result.set(id, name);
  }
  return result;
}

function normalizeBlockText(value: string): string {
  return value.replace(/\t/g, " ").replace(/ *\n */g, "\n").trim();
}
