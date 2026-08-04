"use client";

import Link from "next/link";
import type { FocusEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { StatusMark, TextLink } from "@/src/design-system";
import { focusOnNextFrame, MODULE_DRAWER_FOCUSABLE, trapTabFocus } from "./focus";
import { ModuleMenuPanel } from "./ModuleMenuPanel";
import type { ModuleNavigationItem, ModuleNavigationLabels } from "./types";

export interface ModuleStripProps {
  modules: readonly ModuleNavigationItem[];
  labels: ModuleNavigationLabels;
  currentModule?: string;
  forceOpen?: string | null;
  forceMobileOpen?: boolean;
  defaultExpandedMobileModuleCode?: string;
}

export function ModuleStrip({
  modules,
  labels,
  currentModule,
  forceOpen = null,
  forceMobileOpen = false,
  defaultExpandedMobileModuleCode,
}: ModuleStripProps) {
  const [openCode, setOpenCode] = useState<string | null>(forceOpen);
  const [mobileOpen, setMobileOpen] = useState(forceMobileOpen);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileCloseRef = useRef<HTMLButtonElement | null>(null);
  const desktopTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const lastDesktopCodeRef = useRef<string | null>(forceOpen);
  const suppressNextDesktopFocusRef = useRef(false);
  const mobileId = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (mobileOpen) {
        setMobileOpen(false);
        focusOnNextFrame(mobileTriggerRef);
        return;
      }
      if (openCode) {
        const code = lastDesktopCodeRef.current ?? openCode;
        const trigger = desktopTriggerRefs.current.get(code);
        setOpenCode(null);
        if (document.activeElement !== trigger) {
          suppressNextDesktopFocusRef.current = true;
          requestAnimationFrame(() => trigger?.focus());
        }
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpenCode(null);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [mobileOpen, openCode]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusOnNextFrame(mobileCloseRef);
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const openModule = openCode ? modules.find((module) => module.code === openCode) : undefined;

  return (
    <div
      className="asa-module-strip"
      ref={rootRef}
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenCode(null);
      }}
    >
      <div className="asa-module-strip__inner">
        <span className="asa-module-strip__label">{labels.stripLabel}</span>
        <nav className="asa-module-strip__desktop" aria-label={labels.desktopAriaLabel}>
          {modules.map((module) => (
            <button
              type="button"
              key={module.code}
              ref={(element) => {
                if (element) desktopTriggerRefs.current.set(module.code, element);
                else desktopTriggerRefs.current.delete(module.code);
              }}
              className={module.code === currentModule || module.code === openCode ? "is-active" : ""}
              aria-expanded={module.code === openCode}
              aria-controls={`module-panel-${module.code}`}
              onPointerEnter={() => {
                lastDesktopCodeRef.current = module.code;
                setOpenCode(module.code);
              }}
              onFocus={() => {
                if (suppressNextDesktopFocusRef.current) {
                  suppressNextDesktopFocusRef.current = false;
                  return;
                }
                lastDesktopCodeRef.current = module.code;
                setOpenCode(module.code);
              }}
              onClick={() => {
                lastDesktopCodeRef.current = module.code;
                setOpenCode((current) => current === module.code ? null : module.code);
              }}
            >
              {module.code}
            </button>
          ))}
        </nav>
        <button
          type="button"
          ref={mobileTriggerRef}
          className="asa-module-strip__mobile"
          aria-expanded={mobileOpen}
          aria-controls={mobileId}
          aria-haspopup="dialog"
          onClick={() => setMobileOpen((current) => !current)}
        >
          {labels.stripLabel}
          <span aria-hidden="true">{mobileOpen ? "×" : "+"}</span>
        </button>
      </div>

      {openModule ? (
        <div
          id={`module-panel-${openModule.code}`}
          className="asa-module-strip__panel-wrap"
          onPointerEnter={() => setOpenCode(openModule.code)}
          onPointerLeave={() => setOpenCode(null)}
        >
          <ModuleMenuPanel
            module={openModule}
            panelAriaLabelPrefix={labels.modulePanelAriaLabelPrefix}
            lessonCountSuffix={labels.lessonCountSuffix}
            openLessonLabel={labels.openLessonLabel}
            openModuleLabel={labels.openModuleLabel}
          />
        </div>
      ) : null}

      <div id={mobileId} className={`asa-module-drawer${mobileOpen ? " is-open" : ""}`} aria-hidden={!mobileOpen}>
        <div
          className="asa-drawer__backdrop"
          onClick={() => {
            setMobileOpen(false);
            focusOnNextFrame(mobileTriggerRef);
          }}
          aria-hidden="true"
        />
        <aside
          className="asa-drawer__sheet"
          aria-label={labels.mobileDialogAriaLabel}
          role="dialog"
          aria-modal="true"
          onKeyDown={(event) => trapTabFocus(event, MODULE_DRAWER_FOCUSABLE)}
        >
          <div className="asa-drawer__head">
            <div><span>{labels.mobileCourseEyebrow}</span><strong>{labels.mobileModuleCountLabel}</strong></div>
            <button
              ref={mobileCloseRef}
              type="button"
              onClick={() => {
                setMobileOpen(false);
                focusOnNextFrame(mobileTriggerRef);
              }}
              aria-label={labels.mobileCloseLabel}
            >×</button>
          </div>
          <div className="asa-mobile-modules">
            {modules.map((module) => (
              <details key={module.code} open={module.code === currentModule || module.code === defaultExpandedMobileModuleCode}>
                <summary>
                  <span>{module.code}</span>
                  <div><strong>{module.titleRu}</strong><small>{module.titleEn}</small></div>
                  <StatusMark status={module.status} compact />
                </summary>
                <ol>
                  {module.lessons.map((lesson) => (
                    <li key={lesson.code}>
                      <span>{lesson.shortCode}</span>
                      <strong>{lesson.titleRu}</strong>
                      {lesson.href ? <Link href={lesson.href}>{labels.openLessonLabel}</Link> : null}
                    </li>
                  ))}
                </ol>
                {module.project.href ? (
                  <Link className="asa-mobile-modules__project" href={module.project.href}>
                    <span>{module.project.code}</span>
                    <strong>{module.project.titleRu}</strong>
                  </Link>
                ) : (
                  <div className="asa-mobile-modules__project">
                    <span>{module.project.code}</span>
                    <strong>{module.project.titleRu}</strong>
                  </div>
                )}
                <TextLink href={module.href}>{labels.modulePageLabel}</TextLink>
              </details>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
