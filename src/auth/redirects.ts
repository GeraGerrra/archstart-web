export const DEFAULT_ACCOUNT_DESTINATION = "/prototype/a/dashboard";

export function safeRelativeDestination(value: FormDataEntryValue | string | null | undefined, fallback = DEFAULT_ACCOUNT_DESTINATION): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/\p{Cc}/u.test(value)) return fallback;
  try {
    const base = new URL("https://archstart.invalid");
    const resolved = new URL(value, base);
    if (resolved.origin !== base.origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function signInDestination(next: string): string {
  return `/auth/sign-in?next=${encodeURIComponent(safeRelativeDestination(next))}`;
}
