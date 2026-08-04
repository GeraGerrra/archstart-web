
export const ROUTE_LANGUAGES = Object.freeze({
  core: { prefix: "/", documentLanguage: "ru", contentFamily: "RUSSIAN_FIRST_CORE" },
  documentary: { prefix: "/en", documentLanguage: "en", contentFamily: "ENGLISH_DOCUMENTARY" },
} as const);

export type EnglishDocumentRecord = Readonly<{
  id: string;
  route: `/en${string}`;
  language: "en";
  title: string;
  bodyBlocks: readonly Readonly<{ type: string; text: string }>[];
  reviewStatus: "DRAFT" | "REVIEWED" | "APPROVED";
}>;

export function validateEnglishDocument(record: EnglishDocumentRecord): string[] {
  const errors: string[] = [];
  if (!record.route.startsWith("/en")) errors.push("English documentary route must begin with /en.");
  if (record.language !== "en") errors.push("English documentary record must declare language=en.");
  if (!record.title.trim()) errors.push("Title is required.");
  if (record.bodyBlocks.some((block) => !block.text.trim())) errors.push("Empty body blocks are not allowed.");
  return errors;
}
