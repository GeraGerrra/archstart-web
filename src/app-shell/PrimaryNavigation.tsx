import Link from "next/link";
import type { ShellNavigationItem } from "./types";

export interface PrimaryNavigationProps {
  items: readonly ShellNavigationItem[];
  activeItemId: string;
  ariaLabel: string;
}

export function PrimaryNavigation({ items, activeItemId, ariaLabel }: PrimaryNavigationProps) {
  return (
    <nav className="asa-header__nav" aria-label={ariaLabel}>
      {items.map((item) => (
        <Link key={item.id} href={item.href} aria-current={activeItemId === item.id ? "page" : undefined}>{item.label}</Link>
      ))}
    </nav>
  );
}
