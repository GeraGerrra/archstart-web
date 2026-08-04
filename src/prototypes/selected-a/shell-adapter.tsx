import type { ReactNode } from "react";
import {
  AppShell,
  type HeaderLabels,
  type ModuleNavigationItem,
  type ModuleNavigationLabels,
  type ShellBrand,
  type ShellFooterContent,
  type ShellNavigationItem,
} from "@/src/app-shell";
import { VISUAL_STATUS_LABELS, type VisualStatus } from "@/src/design-system";
import {
  type LessonSummary,
  courseModules,
  moduleLessons,
  moduleProject,
  pathCourse,
  pathDashboard,
  pathHome,
  pathItem,
  pathModule,
  pathProject,
  progress,
} from "./data";

const EMPTY_SHELL_PROGRESS = {
  status: "locked" as const,
  done: 0,
  project: false,
};

export type SelectedAShellActiveSection = "home" | "course" | "dashboard" | "module" | "lesson" | "project" | "account";

export interface SelectedAShellProps {
  children: ReactNode;
  active: SelectedAShellActiveSection;
  currentModule?: string;
  forceModuleMenu?: string | null;
  forceMobileModules?: boolean;
}

export function selectedAStatusForLesson(lesson: LessonSummary): VisualStatus {
  if (lesson.code === "M01_L01") return "complete";
  if (lesson.code === "M01_L02") return "in-progress";
  if (["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08"].includes(lesson.moduleCode)) return lesson.moduleCode === "M04" ? "complete" : "available";
  return "locked";
}

const selectedANavigationItems: readonly ShellNavigationItem[] = [
  { id: "home", label: "Главная", href: pathHome },
  { id: "course", label: "Весь курс", href: pathCourse },
  { id: "dashboard", label: "Мой курс", href: pathDashboard },
];

const selectedABrand: ShellBrand = {
  href: pathHome,
  ariaLabel: "ARCH.START, главная",
  wordmark: {
    src: "/prototype-assets/archstart-wordmark-tight.png",
    alt: "ARCH.START",
    width: 1000,
    height: 138,
    priority: true,
  },
};

const selectedAHeaderLabels: HeaderLabels = {
  primaryNavigationAriaLabel: "Основная навигация",
  mobileTriggerLabel: "МЕНЮ",
  mobileDrawerAriaLabel: "Основная навигация",
  mobileDrawerEyebrow: "НАВИГАЦИЯ",
  mobileDrawerTitle: "ARCH.START",
  mobileCloseLabel: "Закрыть основную навигацию",
  mobileLinksAriaLabel: "Основные разделы",
};

const selectedAModuleLabels: ModuleNavigationLabels = {
  stripLabel: "МОДУЛИ",
  desktopAriaLabel: "Модули курса",
  mobileDialogAriaLabel: "Все модули курса",
  mobileCourseEyebrow: "КУРС",
  mobileModuleCountLabel: "8 модулей",
  mobileCloseLabel: "Закрыть список модулей",
  modulePanelAriaLabelPrefix: "Содержание",
  lessonCountSuffix: "уроков",
  openLessonLabel: "Открыть",
  openModuleLabel: "Открыть модуль",
  modulePageLabel: "Страница модуля",
};

const selectedAModules: readonly ModuleNavigationItem[] = courseModules.map((module) => {
  const state = progress[module.code] ?? EMPTY_SHELL_PROGRESS;
  const project = moduleProject(module.code);
  if (!project) throw new Error(`Selected-A module ${module.code} has no project display record.`);
  const projectStatus: VisualStatus = state.project
    ? "complete"
    : state.status === "locked"
      ? "locked"
      : "available";

  return {
    code: module.code,
    titleRu: module.titleRu,
    titleEn: module.titleEn,
    href: pathModule(module.code),
    lessons: moduleLessons(module.code).map((lesson) => {
      const status = selectedAStatusForLesson(lesson);
      return {
        code: lesson.code,
        displayCode: lesson.code.replace("_", " · "),
        shortCode: lesson.code.slice(-3).replace("_", ""),
        titleRu: lesson.titleRu,
        href: ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08"].includes(lesson.moduleCode) ? pathItem(lesson.moduleCode, lesson.code, "overview") : undefined,
        status,
        quietStatusLabel: VISUAL_STATUS_LABELS[status],
      };
    }),
    project: {
      code: project.code,
      titleRu: project.titleRu,
      href: pathProject(module.code),
      status: projectStatus,
    },
    completedLessonCount: state.done,
    lessonTotal: 5,
    status: state.status,
  };
});

const selectedAFooter: ShellFooterContent = {
  brandLabel: "ARCH.START",
  copy: "Некоммерческий русскоязычный курс архитектуры.",
  links: [
    { href: pathCourse, label: "Весь курс" },
    { href: "/prototype-review", label: "История направлений A, B, C" },
  ],
};


export function SelectedAShell({
  children,
  active,
  currentModule,
  forceModuleMenu,
  forceMobileModules,
}: SelectedAShellProps) {
  return (
    <AppShell
      brand={selectedABrand}
      navigationItems={selectedANavigationItems}
      activeNavigationItemId={active}
      headerLabels={selectedAHeaderLabels}
      modules={selectedAModules}
      moduleLabels={selectedAModuleLabels}
      footer={selectedAFooter}
      currentModule={currentModule}
      forceModuleMenu={forceModuleMenu}
      forceMobileModules={forceMobileModules}
      defaultExpandedMobileModuleCode="M01"
    >
      {children}
    </AppShell>
  );
}
