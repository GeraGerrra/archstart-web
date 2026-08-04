"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { PRIMARY_NAVIGATION_FOCUSABLE, trapTabFocus } from "./focus";
import type { ShellNavigationItem } from "./types";

export interface MobileNavigationProps {
  id: string;
  open: boolean;
  items: readonly ShellNavigationItem[];
  activeItemId: string;
  drawerAriaLabel: string;
  drawerEyebrow: string;
  drawerTitle: string;
  closeLabel: string;
  linksAriaLabel: string;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: (returnFocus?: boolean) => void;
}

export function MobileNavigation({
  id,
  open,
  items,
  activeItemId,
  drawerAriaLabel,
  drawerEyebrow,
  drawerTitle,
  closeLabel,
  linksAriaLabel,
  closeButtonRef,
  onClose,
}: MobileNavigationProps) {
  return (
    <div id={id} className={`asa-primary-drawer${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="asa-primary-drawer__backdrop" aria-hidden="true" onClick={() => onClose()} />
      <aside
        className="asa-primary-drawer__sheet"
        role="dialog"
        aria-modal="true"
        aria-label={drawerAriaLabel}
        onKeyDown={(event) => trapTabFocus(event, PRIMARY_NAVIGATION_FOCUSABLE)}
      >
        <header className="asa-primary-drawer__head">
          <div><span>{drawerEyebrow}</span><strong>{drawerTitle}</strong></div>
          <button ref={closeButtonRef} type="button" onClick={() => onClose()} aria-label={closeLabel}>×</button>
        </header>
        <nav className="asa-primary-drawer__nav" aria-label={linksAriaLabel}>
          {items.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={activeItemId === item.id ? "page" : undefined}
              onClick={() => onClose(false)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.label}</strong>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </nav>
      </aside>
    </div>
  );
}
