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
import { VISUAL_STATUS_LABELS } from "@/src/design-system";
import type { ProjectCode } from "@/src/project-workspace/types";
import {
  COURSE_PROJECT_STATUS_LABELS,
  courseLessonVisualStatus,
  courseModuleVisualStatus,
  courseProjectStatusMap,
  courseProjectVisualStatus,
  type CourseProgressProjection,
} from "@/src/progress/course-progress";
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
} from "./data";

export type SelectedAShellActiveSection = "home" | "course" | "dashboard" | "module" | "lesson" | "project" | "account";

export type SelectedAShellProgressProjection = Pick<
  CourseProgressProjection,
  | "authenticated"
  | "completedLessonCodes"
  | "completedModuleCodes"
  | "activeLessonCodes"
  | "projectStatuses"
  | "currentModuleCode"
>;

export const ANONYMOUS_SHELL_PROGRESS_PROJECTION: SelectedAShellProgressProjection = {
  authenticated: false,
  completedLessonCodes: [],
  completedModuleCodes: [],
  activeLessonCodes: [],
  projectStatuses: courseModules.map((module) => {
    const project = moduleProject(module.code);
    if (!project) throw new Error(`Selected-A module ${module.code} has no project display record.`);
    return { projectCode: project.code as ProjectCode, status: "none" as const };
  }),
  currentModuleCode: "M01",
};

export interface SelectedAShellProps {
  children: ReactNode;
  active: SelectedAShellActiveSection;
  currentModule?: string;
  forceModuleMenu?: string | null;
  forceMobileModules?: boolean;
  progressProjection?: SelectedAShellProgressProjection;
}

export function selectedAStatusForLesson(
  lesson: LessonSummary,
  projection: SelectedAShellProgressProjection = ANONYMOUS_SHELL_PROGRESS_PROJECTION,
) {
  return courseLessonVisualStatus(lesson.code, projection);
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

function selectedAModulesForProjection(
  projection: SelectedAShellProgressProjection,
): readonly ModuleNavigationItem[] {
  const completedLessonCodes = new Set(projection.completedLessonCodes);
  const activeLessonCodes = new Set(projection.activeLessonCodes);
  const projectStatusByCode = courseProjectStatusMap(projection);

  return courseModules.map((module) => {
    const project = moduleProject(module.code);
    if (!project) throw new Error(`Selected-A module ${module.code} has no project display record.`);

    const lessons = moduleLessons(module.code);
    const completedLessonCount = lessons.filter((lesson) => completedLessonCodes.has(lesson.code)).length;
    const projectCode = project.code as ProjectCode;
    const projectStatus = projectStatusByCode.get(projectCode) ?? "none";

    return {
      code: module.code,
      titleRu: module.titleRu,
      titleEn: module.titleEn,
      href: pathModule(module.code),
      lessons: lessons.map((lesson) => {
        const status = courseLessonVisualStatus(lesson.code, projection);
        return {
          code: lesson.code,
          displayCode: lesson.code.replace("_", " · "),
          shortCode: lesson.code.slice(-3).replace("_", ""),
          titleRu: lesson.titleRu,
          href: pathItem(lesson.moduleCode, lesson.code, "overview"),
          status,
          quietStatusLabel: VISUAL_STATUS_LABELS[status],
        };
      }),
      project: {
        code: project.code,
        titleRu: project.titleRu,
        href: pathProject(module.code),
        status: courseProjectVisualStatus(projectStatus),
        statusLabel: COURSE_PROJECT_STATUS_LABELS[projectStatus],
      },
      completedLessonCount,
      lessonTotal: 5,
      status: courseModuleVisualStatus(
        module.code,
        projection,
        projectCode,
      ),
    };
  });
}

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
  progressProjection,
}: SelectedAShellProps) {
  return (
    <AppShell
      brand={selectedABrand}
      navigationItems={selectedANavigationItems}
      activeNavigationItemId={active}
      headerLabels={selectedAHeaderLabels}
      headerProgress={progressProjection?.authenticated ? {
        value: `${progressProjection.completedLessonCodes.length} / 40`,
        label: "уроков",
        ariaLabel: `${progressProjection.completedLessonCodes.length} из 40 уроков завершено`,
      } : undefined}
      modules={selectedAModulesForProjection(
        progressProjection ?? ANONYMOUS_SHELL_PROGRESS_PROJECTION,
      )}
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
