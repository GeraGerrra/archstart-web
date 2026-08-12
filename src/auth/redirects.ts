import { canonicalizeLegacySelectedAPathname } from "@/src/routing/production-routes";

export const DEFAULT_ACCOUNT_DESTINATION = "/dashboard";

export function safeRelativeDestination(value: FormDataEntryValue | string | null | undefined, fallback = DEFAULT_ACCOUNT_DESTINATION): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/\p{Cc}/u.test(value)) return fallback;
  try {
    const base = new URL("https://archstart.invalid");
    const resolved = new URL(value, base);
    if (resolved.origin !== base.origin) return fallback;
    const pathname = canonicalizeLegacySelectedAPathname(resolved.pathname);
    return `${pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function signInDestination(next: string): string {
  return `/auth/sign-in?next=${encodeURIComponent(safeRelativeDestination(next))}`;
}
