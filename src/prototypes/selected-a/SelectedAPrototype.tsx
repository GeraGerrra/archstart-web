import {
  ITEMS,
  type ItemId,
  type Lesson,
  type ModuleSummary,
  type Status,
  courseIndex,
  courseLessons,
  courseModules,
  getLesson,
  getImportedModuleData,
  getModule,
  itemIs,
  itemsFor,
  m01Lessons,
  m01Module,
  m01Project,
  moduleLessons,
  moduleProject,
  pathCourse,
  pathItem,
  pathModule,
  pathProject,
  primaryAudience,
  progress,
  totals,
} from "./data";
import type { MyCertificateProjection } from "@/src/certificate/types";
import {
  SelectedAShell,
  selectedAStatusForLesson as statusForLesson,
  type SelectedAShellProgressProjection,
} from "./shell-adapter";
import {
  selectedALessonMapping,
  selectedAProjectExample,
  type SelectedALessonMapping,
} from "./lesson-adapter";
import {
  CourseOverviewPage,
  DashboardPage,
  HomePage,
  LessonWorkspace,
  ModuleOverviewPage,
  OverviewItem,
  PracticeItem,
  ProjectOverviewPage,
  ResourcesItem,
  type CourseModuleCardDisplay,
  type CourseOverviewViewModel,
  type DashboardViewModel,
  type HomePageViewModel,
  type ModuleLessonBranchDisplay,
  type ModuleOverviewViewModel,
  type ProjectOverviewViewModel,
} from "@/src/learning";
import {
  LectureMaterialsViewer,
  ProjectPackViewer,
  RevealExample,
  VideoItem,
  VocabularyViewer,
} from "@/src/media";
import { CutoutCompletionButton } from "@/src/completion";
import type { CompletionMutationAction } from "@/src/completion";
import { QuizShell } from "@/src/quiz";
import type { QuizSubmissionAction } from "@/src/quiz/types";
import type { ProjectCode } from "@/src/project-workspace/types";
import {
  selectedACompletionViewModel,
  selectedACutout,
} from "./completion-adapter";
import { furtherStudyForModule } from "./module-further-study";
import {
  ANONYMOUS_COURSE_PROGRESS_PROJECTION,
  COURSE_PROJECT_STATUS_LABELS,
  courseLessonVisualStatus,
  courseModuleVisualStatus,
  courseProjectStatusMap,
  courseProjectVisualStatus,
  type CourseProgressProjection,
} from "@/src/progress/course-progress";

export type { CompletionDemoState } from "@/src/completion";
import type { CompletionDemoState } from "@/src/completion";
import type { ReactNode } from "react";

const HOME_MODULE_SHORT_TITLES: Readonly<Record<string, string>> = {
  M01: "Пространство, масштаб, функция",
  M02: "История и стили",
  M03: "Участок и климат",
  M04: "Конструкции",
  M05: "Материалы",
  M06: "Устойчивые стратегии",
  M07: "Риски и устойчивость",
  M08: "Презентация проекта",
};

const EMPTY_PROGRESS = { status: "locked" as Status, done: 0, project: false, label: "Закрыт" };

const SELECTED_A_PUBLIC_ZERO_PROGRESS = ANONYMOUS_COURSE_PROGRESS_PROJECTION;

function selectedACourseModule(
  module: ModuleSummary,
  projection: CourseProgressProjection,
): CourseModuleCardDisplay {
  const lessons = moduleLessons(module.code);
  const project = moduleProject(module.code);
  if (!project) throw new Error(`Selected-A module ${module.code} has no project display record.`);
  const projectCode = project.code as ProjectCode;
  const projectStatus = courseProjectStatusMap(projection).get(projectCode) ?? "none";
  const completedLessons = lessons.filter(
    (lesson) => projection.completedLessonCodes.includes(lesson.code),
  ).length;

  return {
    code: module.code,
    titleRu: module.titleRu,
    titleEn: module.titleEn,
    goal: module.goal,
    href: pathModule(module.code),
    status: courseModuleVisualStatus(module.code, projection, projectCode),
    completedLessons,
    lessonTotal: 5,
    cutout: selectedACutout(module.code),
    lessons: lessons.map((lesson) => {
      const status = courseLessonVisualStatus(lesson.code, projection);
      return {
        code: lesson.code,
        shortCode: lesson.code.slice(-3).replace("_", ""),
        titleRu: lesson.titleRu,
        status,
        action: { label: "Открыть", href: pathItem(module.code, lesson.code, "overview") },
        quietStatusLabel: undefined,
      };
    }),
    project: {
      code: project.code,
      titleRu: project.titleRu,
      href: pathProject(module.code),
      status: courseProjectVisualStatus(projectStatus),
      statusLabel: COURSE_PROJECT_STATUS_LABELS[projectStatus],
    },
  };
}

const selectedAHomeModel: HomePageViewModel = {
  hero: {
    title: "Учимся видеть архитектуру как систему решений.",
    lead: "Пространство, история, климат, конструкция, материалы, устойчивость, resilience и презентация проекта складываются в один последовательный курс.",
    audienceLabel: "Для кого", audience: primaryAudience,
  },
  primaryAction: { label: "Открыть весь курс", href: pathCourse },
  secondaryAction: { label: "Начать M01 · L01", href: pathItem("M01", "M01_L01", "overview") },
  cutoutStageLabel: "Восемь модулей курса",
  cutouts: courseModules.map((module, index) => ({
    code: module.code, titleRu: module.titleRu, mobileTitle: HOME_MODULE_SHORT_TITLES[module.code] ?? module.titleRu,
    href: pathModule(module.code), image: selectedACutout(module.code, index < 4),
  })),
  defaultCaption: `M01 — ${courseModules[0]?.titleRu ?? "Архитектурное мышление: пространство, масштаб, функция"}`,
  metricsLabel: "Структура курса",
  metrics: [
    { value: courseIndex.course.moduleCount, label: "модулей" },
    { value: courseIndex.course.lessonCount, label: "уроков" },
    { value: courseIndex.course.projectCount, label: "модульных проектов" },
  ],
  moduleListTitle: "Восемь способов читать архитектуру",
  moduleListAction: { label: "Полная структура и прогресс", href: pathCourse },
  modules: courseModules.map((module) => ({ code: module.code, titleRu: module.titleRu, titleEn: module.titleEn, href: pathModule(module.code) })),
  output: {
    sectionTitle: "Что создают участники", title: "Space Reading Board",
    description: "Полный проектный планшет находится ниже курса, а не заменяет собой его главную идею. Это реальный пример итогового формата Project 01.",
    action: { label: "Открыть Project 01", href: pathProject("M01") },
    image: { src: "/prototype-assets/m01-project-01-preview.png", alt: "Пример Space Reading Board для Project 01", width: 2001, height: 1125 },
    imageButtonLabel: "Открыть увеличенный проектный планшет",
  },
};

function selectedACourseModelForProjection(
  projection: CourseProgressProjection,
): CourseOverviewViewModel {
  const acceptedProjects = projection.projectStatuses.filter(
    (entry) => entry.status === "accepted",
  ).length;
  const continueLessonCode = projection.continueLessonCode ?? "M01_L01";
  const continueLesson = getLesson(continueLessonCode) ?? m01Lessons[0]!;

  return {
    title: "Курс ARCH.START",
    summary: "Полная карта обучения: восемь модулей, сорок уроков и один проект после каждого модуля.",
    demoDisclosure: projection.authenticated
      ? "Показан сохранённый прогресс этого аккаунта. Уроки и проекты учитываются отдельно."
      : "Без аккаунта показано нулевое стартовое состояние. Войдите в «Мой курс», чтобы видеть и сохранять личный прогресс.",
    continueAction: {
      label: projection.authenticated ? "Продолжить обучение" : "Начать обучение",
      href: pathItem(continueLesson.moduleCode, continueLesson.code, "overview"),
    },
    totals: {
      completedLessons: projection.completedLessonCodes.length,
      lessonTotal: 40,
      completedModules: projection.completedModuleCodes.length,
      moduleTotal: 8,
      completedProjects: acceptedProjects,
      projectTotal: 8,
      quizQuestions: courseIndex.course.quizQuestionCount,
    },
    moduleListTitle: "Все модули курса",
    modules: courseModules.map((module) => selectedACourseModule(module, projection)),
  };
}

const selectedADashboardModel: DashboardViewModel = {
  title: "Продолжить с того места, где остановились.", disclosure: "История, авторизация и сохранение прогресса пока не подключены.",
  completedLessons: totals.lessons, lessonTotal: 40,
  continueLearning: {
    code: "M01 · L02", titleRu: m01Lessons[1]?.titleRu ?? "", titleEn: m01Lessons[1]?.titleEn ?? "",
    action: { label: "Продолжить со словаря", href: pathItem("M01", "M01_L02", "vocabulary") },
  },
  moduleMapTitle: "Позиция в курсе",
  modules: courseModules.map((module) => {
    const state = progress[module.code] ?? EMPTY_PROGRESS;
    return {
      code: module.code, titleRu: module.titleRu, titleEn: module.titleEn, completedLessons: state.done,
      lessonTotal: 5, progressLabel: state.label, action: { label: "Открыть", href: pathModule(module.code) },
    };
  }),
  emptyHistory: {
    title: "Истории пока нет",
    description: "Здесь появятся реальные недавние уроки только после реализации аккаунта и сохранения прогресса.",
    records: [{ label: "Аккаунт", value: "не подключён" }, { label: "Синхронизация", value: "не подключена" }],
  },
};

export function SelectedAHome({
  forceModuleMenu,
  forceMobileModules,
  progressProjection = SELECTED_A_PUBLIC_ZERO_PROGRESS,
}: {
  forceModuleMenu?: string | null;
  forceMobileModules?: boolean;
  progressProjection?: CourseProgressProjection;
}) {
  return (
    <SelectedAShell
      active="home"
      forceModuleMenu={forceModuleMenu}
      forceMobileModules={forceMobileModules}
      progressProjection={progressProjection}
    >
      <HomePage model={selectedAHomeModel} />
    </SelectedAShell>
  );
}

export function SelectedACourse({
  forceModuleMenu,
  forceMobileModules,
  progressProjection = SELECTED_A_PUBLIC_ZERO_PROGRESS,
}: {
  forceModuleMenu?: string | null;
  forceMobileModules?: boolean;
  progressProjection?: CourseProgressProjection;
}) {
  return (
    <SelectedAShell
      active="course"
      currentModule={progressProjection.currentModuleCode}
      forceModuleMenu={forceModuleMenu}
      forceMobileModules={forceMobileModules}
      progressProjection={progressProjection}
    >
      <CourseOverviewPage model={selectedACourseModelForProjection(progressProjection)} />
    </SelectedAShell>
  );
}

export function SelectedADashboard({
  model = selectedADashboardModel,
  progressProjection,
  certificateProjection,
}: {
  model?: DashboardViewModel;
  progressProjection?: SelectedAShellProgressProjection;
  certificateProjection?: MyCertificateProjection;
} = {}) {
  return (
    <SelectedAShell
      active="dashboard"
      currentModule={progressProjection?.currentModuleCode ?? "M01"}
      progressProjection={progressProjection}
    >
      <DashboardPage model={model} certificateProjection={certificateProjection} />
    </SelectedAShell>
  );
}

function selectedAModuleLesson(
  lesson: (typeof courseLessons)[number],
  progressProjection: CourseProgressProjection,
): ModuleLessonBranchDisplay {
  const actual = getLesson(lesson.code);
  const visibleItems = actual ? itemsFor(actual) : ITEMS.filter((entry) => entry.id !== "resources");
  return {
    code: lesson.code, order: lesson.orderInModule, titleRu: lesson.titleRu, titleEn: lesson.titleEn,
    objective: lesson.objective, status: statusForLesson(lesson, progressProjection),
    items: visibleItems.map((item) => ({
      id: item.id, titleRu: item.ru, titleEn: item.en,
      action: actual ? { label: "Открыть", href: pathItem(lesson.moduleCode, lesson.code, item.id) } : undefined,
      pendingLabel: actual ? undefined : "Маршрут позже",
    })),
  };
}

export function SelectedAModule({
  moduleCode,
  expandedLesson,
  forceModuleMenu,
  completionState = "locked",
  progressProjection = SELECTED_A_PUBLIC_ZERO_PROGRESS,
  completeCompletionAction,
  undoCompletionAction,
}: {
  moduleCode: string;
  expandedLesson?: string | null;
  forceModuleMenu?: string | null;
  completionState?: CompletionDemoState;
  progressProjection?: CourseProgressProjection;
  completeCompletionAction?: CompletionMutationAction;
  undoCompletionAction?: CompletionMutationAction;
}) {
  const courseModule = getModule(moduleCode) ?? m01Module;
  const lessons = moduleLessons(courseModule.code);
  const project = moduleProject(courseModule.code);
  if (!project) throw new Error(`Selected-A module ${courseModule.code} has no project display record.`);
  const projectCode = project.code as ProjectCode;
  const projectStatus = courseProjectStatusMap(progressProjection).get(projectCode) ?? "none";
  const completedLessons = lessons.filter(
    (lesson) => progressProjection.completedLessonCodes.includes(lesson.code),
  ).length;
  const model: ModuleOverviewViewModel = {
    code: courseModule.code,
    titleRu: courseModule.titleRu,
    titleEn: courseModule.titleEn,
    goal: courseModule.goal,
    cutout: selectedACutout(courseModule.code, true),
    completedLessons,
    lessonTotal: 5,
    outcomes: courseModule.outcomes.map(({ order, label, text }) => ({ order, label, text })),
    lessons: lessons.map((lesson) => selectedAModuleLesson(lesson, progressProjection)),
    project: {
      code: project.code,
      titleRu: project.titleRu,
      titleEn: project.titleEn,
      objective: project.objective,
      status: courseProjectVisualStatus(projectStatus),
      statusLabel: COURSE_PROJECT_STATUS_LABELS[projectStatus],
      action: { label: "Открыть проект", href: pathProject(courseModule.code) },
    },
    furtherStudy: furtherStudyForModule(courseModule.code),
  };
  return (
    <SelectedAShell
      active="module"
      currentModule={courseModule.code}
      forceModuleMenu={forceModuleMenu}
      progressProjection={progressProjection}
    >
      <ModuleOverviewPage
        model={model}
        initialExpandedLessonCode={expandedLesson ?? `${courseModule.code}_L01`}
        completionContent={(
          <CutoutCompletionButton
            key={`${courseModule.code}:${completionState}`}
            model={selectedACompletionViewModel({
              kind: "module",
              moduleCode: courseModule.code,
              state: completionState,
            })}
            completeAction={completeCompletionAction}
            undoAction={undoCompletionAction}
          />
        )}
      />
    </SelectedAShell>
  );
}

export function SelectedAProject({
  moduleCode,
  workspaceContent,
  progressProjection = SELECTED_A_PUBLIC_ZERO_PROGRESS,
}: {
  moduleCode: string;
  workspaceContent?: ReactNode;
  progressProjection?: CourseProgressProjection;
}) {
  const courseModule = getModule(moduleCode) ?? m01Module;
  const project = getImportedModuleData(courseModule.code)?.project ?? (moduleProject(courseModule.code) ?? m01Project);
  const projectBlocks = project.normalizedPublicContent?.blocks;
  const exampleHeading = projectBlocks?.find((block) => block.type === "paragraph" && /\bOUR EXAMPLE\b/iu.test(block.text ?? ""));
  const model: ProjectOverviewViewModel = {
    kicker: "Проект модуля", code: project.code, titleRu: project.titleRu, titleEn: project.titleEn,
    objective: project.objective,
    assessedOutcomes: project.assessedOutcomes.map(({ order, label, text }) => ({ order, label, text })),
    contentBlocks: projectBlocks?.filter((block) => block.order >= 5)
      .map(({ order, type, style, text, rows }) => ({ order, type, style, text, rows })),
    exampleBlockOrder: exampleHeading?.order,
    exampleCaptionBlockOrder: exampleHeading ? projectBlocks?.find((block) => block.order > exampleHeading.order)?.order : undefined,
    backAction: { label: "Вернуться к модулю", href: pathModule(courseModule.code) },
  };
  const projectExample = selectedAProjectExample(courseModule.code);
  return (
    <SelectedAShell active="project" currentModule={courseModule.code} progressProjection={progressProjection}>
      <ProjectOverviewPage model={model} exampleContent={courseModule.code === "M08" ? (
        <ProjectPackViewer
          title="Project 08 — Final Architecture Presentation Pack"
          pdfPath="/prototype-assets/m08-project-08-example.pdf"
          pageImagePaths={Array.from({ length: 10 }, (_, index) => `/prototype-assets/m08-project-08-page-${String(index + 1).padStart(2, "0")}.png`)}
          pageWidth={1920}
          pageHeight={1080}
        />
      ) : projectExample ? (
        <RevealExample {...projectExample} />
      ) : <div className="asa-project__pending">Проектный маршрут показан структурно. Полный импорт ещё не выполнен.</div>}
      workspaceContent={workspaceContent}
      />
    </SelectedAShell>
  );
}

interface SelectedALessonProps {
  lessonCode: string;
  item: ItemId;
  completionState?: CompletionDemoState;
  forceContents?: boolean;
  forceModuleMenu?: string | null;
  progressProjection?: CourseProgressProjection;
  quizSubmitAction?: QuizSubmissionAction;
  completeCompletionAction?: CompletionMutationAction;
  undoCompletionAction?: CompletionMutationAction;
}

function renderItem(lesson: Lesson, item: ItemId, mapping: SelectedALessonMapping, quizSubmitAction?: QuizSubmissionAction) {
  switch (item) {
    case "overview": return <OverviewItem model={mapping.overview} />;
    case "vocabulary": return <VocabularyViewer model={mapping.vocabulary} />;
    case "video": return <VideoItem model={mapping.video} />;
    case "lecture-materials": return <LectureMaterialsViewer model={mapping.lectureMaterials} />;
    // Legacy aliases: redirect pages handle 301, but renderItem covers direct SSR fallback
    case "transcript": return <LectureMaterialsViewer model={mapping.lectureMaterials} />;
    case "slides": return <LectureMaterialsViewer model={mapping.lectureMaterials} />;
    case "practice": return <PracticeItem model={mapping.practice} exampleContent={mapping.practiceExample ? (
      <RevealExample
        src={mapping.practiceExample.src}
        alt={mapping.practiceExample.alt}
        width={mapping.practiceExample.width}
        height={mapping.practiceExample.height}
        caption={mapping.practiceExample.caption}
      />
    ) : undefined} />;
    case "quiz": return mapping.quiz ? <QuizShell model={mapping.quiz} lessonCode={lesson.code} submitAction={quizSubmitAction} /> : <div className="asa-item"><p>Квиз для урока не найден.</p></div>;
    case "resources": return mapping.resources ? <ResourcesItem model={mapping.resources} /> : null;
  }
}

export function SelectedALesson({
  lessonCode,
  item,
  completionState = "locked",
  forceContents = false,
  forceModuleMenu,
  progressProjection = SELECTED_A_PUBLIC_ZERO_PROGRESS,
  quizSubmitAction,
  completeCompletionAction,
  undoCompletionAction,
}: SelectedALessonProps) {
  const lesson = getLesson(lessonCode) ?? m01Lessons[0]!;
  const visibleItems = itemsFor(lesson);
  const validItem = visibleItems.some((entry) => entry.id === item) ? item : "overview";
  const mapping = selectedALessonMapping(lesson, validItem, progressProjection);

  return (
    <SelectedAShell active="lesson" currentModule={lesson.moduleCode} forceModuleMenu={forceModuleMenu} progressProjection={progressProjection}>
      <LessonWorkspace
        model={mapping.workspace}
        activeItemContent={renderItem(lesson, validItem, mapping, quizSubmitAction)}
        completionContent={validItem === "quiz" ? (
          <CutoutCompletionButton
            key={`${lesson.code}:${completionState}`}
            model={selectedACompletionViewModel({
              kind: "lesson",
              moduleCode: lesson.moduleCode,
              state: completionState,
              nextAction: mapping.completionAction,
            })}
            completeAction={completeCompletionAction}
            undoAction={undoCompletionAction}
          />
        ) : undefined}
        initialContentsOpen={forceContents}
      />
    </SelectedAShell>
  );
}

export function validSelectedAItem(value: string, lesson: Lesson): value is ItemId {
  return itemIs(value) && itemsFor(lesson).some((entry) => entry.id === value);
}
