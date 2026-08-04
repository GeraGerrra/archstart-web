
const FORBIDDEN_PATH_PATTERNS = [
  /\/mnt\//i,
  /\b[A-Z]:\\/i,
  /OneDrive/i,
  /file:\/\//i,
] as const;

export function findForbiddenPublicPaths(value: unknown): string[] {
  const text = JSON.stringify(value);
  return FORBIDDEN_PATH_PATTERNS.filter((pattern) => pattern.test(text)).map(String);
}
