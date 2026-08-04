"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { focusOnNextFrame } from "./focus";
import { MobileNavigation } from "./MobileNavigation";
import { PrimaryNavigation } from "./PrimaryNavigation";
import type { HeaderLabels, ShellBrand, ShellNavigationItem } from "./types";

export interface HeaderProps {
  brand: ShellBrand;
  navigationItems: readonly ShellNavigationItem[];
  activeNavigationItemId: string;
  labels: HeaderLabels;
}

export function Header({ brand, navigationItems, activeNavigationItemId, labels }: HeaderProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavId = useId();
  const mobileNavTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileNavCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusOnNextFrame(mobileNavCloseRef);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileNavOpen(false);
      focusOnNextFrame(mobileNavTriggerRef);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  function closeMobileNavigation(returnFocus = true) {
    setMobileNavOpen(false);
    if (returnFocus) focusOnNextFrame(mobileNavTriggerRef);
  }

  return (
    <>
      <header className="asa-header">
        <div className="asa-header__inner">
          <Link className="asa-header__brand asa-wordmark" href={brand.href} aria-label={brand.ariaLabel}>
            <Image
              src={brand.wordmark.src}
              alt={brand.wordmark.alt}
              width={brand.wordmark.width}
              height={brand.wordmark.height}
              priority={brand.wordmark.priority}
            />
          </Link>
          <PrimaryNavigation
            items={navigationItems}
            activeItemId={activeNavigationItemId}
            ariaLabel={labels.primaryNavigationAriaLabel}
          />
          <div className="asa-header__utilities">
            <button
              ref={mobileNavTriggerRef}
              type="button"
              className="asa-header__mobile-nav-trigger"
              aria-expanded={mobileNavOpen}
              aria-controls={mobileNavId}
              aria-haspopup="dialog"
              onClick={() => setMobileNavOpen((current) => !current)}
            >
              {labels.mobileTriggerLabel}
              <span aria-hidden="true">{mobileNavOpen ? "×" : "+"}</span>
            </button>
          </div>
        </div>
      </header>
      <MobileNavigation
        id={mobileNavId}
        open={mobileNavOpen}
        items={navigationItems}
        activeItemId={activeNavigationItemId}
        drawerAriaLabel={labels.mobileDrawerAriaLabel}
        drawerEyebrow={labels.mobileDrawerEyebrow}
        drawerTitle={labels.mobileDrawerTitle}
        closeLabel={labels.mobileCloseLabel}
        linksAriaLabel={labels.mobileLinksAriaLabel}
        closeButtonRef={mobileNavCloseRef}
        onClose={closeMobileNavigation}
      />
    </>
  );
}
