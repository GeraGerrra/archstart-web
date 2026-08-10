import type { VisualStatus } from "@/src/design-system";

/** Display-only primary navigation item supplied by the owning product section. */
export interface ShellNavigationItem {
  id: string;
  label: string;
  href: string;
}

/** Wordmark metadata approved for a shell brand link. */
export interface ShellWordmark {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
}

/** Brand link rendered by the shared header. */
export interface ShellBrand {
  href: string;
  ariaLabel: string;
  wordmark: ShellWordmark;
}

/** Display/navigation model for one lesson inside module navigation. */
export interface ModuleLessonNavigationItem {
  code: string;
  displayCode: string;
  shortCode: string;
  titleRu: string;
  href?: string;
  status: VisualStatus;
  quietStatusLabel?: string;
}

/** Display/navigation model for a module project. */
export interface ModuleProjectNavigationItem {
  code: string;
  titleRu: string;
  href?: string;
  status: VisualStatus;
  statusLabel?: string;
}

/** Serializable shell-owned view of one module. */
export interface ModuleNavigationItem {
  code: string;
  titleRu: string;
  titleEn: string;
  href: string;
  lessons: readonly ModuleLessonNavigationItem[];
  project: ModuleProjectNavigationItem;
  completedLessonCount: number;
  lessonTotal: number;
  status: VisualStatus;
}

/** Footer destination supplied by the owning product section. */
export interface ShellFooterLink {
  label: string;
  href: string;
}

/** Narrow footer content contract. */
export interface ShellFooterContent {
  brandLabel: string;
  copy: string;
  links: readonly ShellFooterLink[];
}

/** Optional account-scoped progress displayed in the shared header. */
export interface ShellHeaderProgress {
  value: string;
  label: string;
  ariaLabel: string;
}

/** Approved labels for the reusable header and primary navigation. */
export interface HeaderLabels {
  primaryNavigationAriaLabel: string;
  mobileTriggerLabel: string;
  mobileDrawerAriaLabel: string;
  mobileDrawerEyebrow: string;
  mobileDrawerTitle: string;
  mobileCloseLabel: string;
  mobileLinksAriaLabel: string;
}

/** Approved labels for the reusable module navigation. */
export interface ModuleNavigationLabels {
  stripLabel: string;
  desktopAriaLabel: string;
  mobileDialogAriaLabel: string;
  mobileCourseEyebrow: string;
  mobileModuleCountLabel: string;
  mobileCloseLabel: string;
  modulePanelAriaLabelPrefix: string;
  lessonCountSuffix: string;
  openLessonLabel: string;
  openModuleLabel: string;
  modulePageLabel: string;
}
