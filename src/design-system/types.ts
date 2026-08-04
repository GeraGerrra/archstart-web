/** Visual state rendered by low-level status primitives. */
export type VisualStatus = "complete" | "in-progress" | "available" | "locked";

/** Language identity for a product section, not a translation-availability claim. */
export type SectionLanguage = "ru-first" | "en-documentary";

/** Truthful maturity classification for non-persistent Phase 03 state. */
export type DemoStateClassification = "production-ready" | "demo-only" | "pending-integration";

/** Approved low-level button treatments extracted from selected A. */
export type ButtonVariant = "dark" | "line";

/** Truthful material-availability state. */
export type MaterialState = "pending" | "unavailable";

/** Display-only module identity; this does not duplicate a content-engine record. */
export interface ModuleIdentityDisplay {
  kind: "module";
  code: string;
  titleRu: string;
  titleEn?: string;
}

/** Display-only lesson identity; this does not duplicate a content-engine record. */
export interface LessonIdentityDisplay {
  kind: "lesson";
  code: string;
  moduleCode: string;
  titleRu: string;
  titleEn?: string;
}

export type LearningIdentityDisplay = ModuleIdentityDisplay | LessonIdentityDisplay;

/**
 * Accepted responsive contracts. CSS variables cannot be consumed in media
 * conditions, so the values are documented as typed constants instead.
 */
export const ARCHSTART_BREAKPOINTS = {
  compact: 390,
  mobile: 640,
  cutoutStack: 820,
  moduleTitleStack: 920,
  wide: 1100,
} as const;

export type ArchstartBreakpoint = keyof typeof ARCHSTART_BREAKPOINTS;
