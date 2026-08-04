export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function xmlText(fragment: string): string {
  const inDocumentOrder = fragment
    .replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, (_match, text: string) => text)
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeXmlEntities(inDocumentOrder).replace(/\u00a0/g, " ");
}

export function xmlAttribute(fragment: string, name: string): string | null {
  const match = new RegExp(`\\b${name}=["']([^"']*)["']`).exec(fragment);
  return match ? decodeXmlEntities(match[1] ?? "") : null;
}
