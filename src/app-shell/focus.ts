import type { KeyboardEvent, RefObject } from "react";

export const PRIMARY_NAVIGATION_FOCUSABLE = "button, a[href], [tabindex]:not([tabindex='-1'])";
export const MODULE_DRAWER_FOCUSABLE = "button, a[href], summary, input, [tabindex]:not([tabindex='-1'])";

export function focusOnNextFrame<T extends HTMLElement>(ref: RefObject<T | null>): void {
  requestAnimationFrame(() => ref.current?.focus());
}

export function trapTabFocus(event: KeyboardEvent<HTMLElement>, selector: string): void {
  if (event.key !== "Tab") return;
  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(selector))
    .filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);
  if (focusable.length === 0) return;
  const first = focusable[0]!;
  const last = focusable.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
