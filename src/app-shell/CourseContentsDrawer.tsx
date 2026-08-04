"use client";

import type { ReactNode } from "react";

export interface CourseContentsDrawerProps {
  open: boolean;
  eyebrow: string;
  title: string;
  ariaLabel: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

export function CourseContentsDrawer({
  open,
  eyebrow,
  title,
  ariaLabel,
  closeLabel,
  onClose,
  children,
}: CourseContentsDrawerProps) {
  return (
    <div className={`asa-contents-drawer${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="asa-drawer__backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="asa-drawer__sheet" aria-label={ariaLabel}>
        <div className="asa-drawer__head"><div><span>{eyebrow}</span><strong>{title}</strong></div><button type="button" onClick={onClose} aria-label={closeLabel}>×</button></div>
        {children}
      </aside>
    </div>
  );
}
