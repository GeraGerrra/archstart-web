export interface SearchMatchSegment {
  text: string;
  isMatch: boolean;
}

export function escapeSearchRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function splitSearchMatches(text: string, query: string): readonly SearchMatchSegment[] {
  if (!query) return [{ text, isMatch: false }];

  const expression = new RegExp(escapeSearchRegExp(query), "giu");
  const output: SearchMatchSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(expression)) {
    const index = match.index ?? 0;
    if (index > cursor) output.push({ text: text.slice(cursor, index), isMatch: false });
    output.push({ text: match[0], isMatch: true });
    cursor = index + match[0].length;
  }

  if (output.length === 0) return [{ text, isMatch: false }];
  if (cursor < text.length) output.push({ text: text.slice(cursor), isMatch: false });
  return output;
}
