
const FORBIDDEN_PUBLIC_QUIZ_KEYS = new Set([
  "correctAnswer",
  "correctLetter",
  "correctOptionId",
  "answerKey",
  "explanation",
]);

export function findForbiddenQuizKeys(value: unknown): string[] {
  const found = new Set<string>();
  function walk(node: unknown): void {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      if (FORBIDDEN_PUBLIC_QUIZ_KEYS.has(key)) found.add(key);
      walk(child);
    }
  }
  walk(value);
  return [...found].sort();
}
