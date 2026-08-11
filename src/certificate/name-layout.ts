export type CertificateNameScale = "standard" | "long" | "extra-long";

export interface CertificateNameLayout {
  lines: string[];
  scale: CertificateNameScale;
  fontSizeCqw: number;
}

const NAME_AREA_WIDTH_CQW = 62;
const ESTIMATED_UPPERCASE_GLYPH_WIDTH_EM = 0.6;
const MAX_FONT_SIZE_CQW = 9.9;
const MIN_FONT_SIZE_CQW = 2.8;

function fittedFontSize(longestLineLength: number): number {
  if (longestLineLength <= 0) return MAX_FONT_SIZE_CQW;
  const fitted = NAME_AREA_WIDTH_CQW
    / (longestLineLength * ESTIMATED_UPPERCASE_GLYPH_WIDTH_EM);
  return Number(Math.min(
    MAX_FONT_SIZE_CQW,
    Math.max(MIN_FONT_SIZE_CQW, fitted),
  ).toFixed(3));
}

export function certificateNameLayout(value: string): CertificateNameLayout {
  const normalized = value.trim().replace(/\s+/gu, " ");
  const tokens = normalized.split(" ").filter(Boolean);
  let lines: string[];

  if (tokens.length <= 1) {
    lines = [normalized];
  } else if (tokens.length === 2) {
    lines = tokens;
  } else {
    let splitIndex = 1;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let index = 1; index < tokens.length; index += 1) {
      const left = tokens.slice(0, index).join(" ");
      const right = tokens.slice(index).join(" ");
      const delta = Math.abs(left.length - right.length);
      if (delta < bestDelta) {
        bestDelta = delta;
        splitIndex = index;
      }
    }
    lines = [tokens.slice(0, splitIndex).join(" "), tokens.slice(splitIndex).join(" ")];
  }

  const longestLine = Math.max(...lines.map((line) => line.length));
  const fontSizeCqw = fittedFontSize(longestLine);
  const scale: CertificateNameScale = fontSizeCqw >= 8.8
    ? "standard"
    : fontSizeCqw >= 5.5
      ? "long"
      : "extra-long";

  return { lines, scale, fontSizeCqw };
}
