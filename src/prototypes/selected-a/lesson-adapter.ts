import {
  ITEMS,
  type ItemId,
  type Lesson,
  courseLessons,
  getImportedModuleData,
  itemsFor,
  nextActionForLesson,
  pathCourse,
  pathItem,
  pathModule,
  pathProject,
  quizByLesson,
} from "./data";
import { PENDING_MATERIAL_MESSAGE, getLessonPrototypeAssets } from "./lesson-assets";
import { selectedAStatusForLesson as statusForLesson } from "./shell-adapter";
import type {
  LessonWorkspaceViewModel,
  OverviewItemViewModel,
  PracticeItemViewModel,
  ResourcesItemViewModel,
} from "@/src/learning";
import type {
  LectureMaterialsViewerViewModel,
  RevealExampleProps,
  VideoItemViewModel,
  VocabularyViewerViewModel,
} from "@/src/media";
import type { QuizShellViewModel } from "@/src/quiz";

export interface SelectedALessonMapping {
  workspace: LessonWorkspaceViewModel;
  overview: OverviewItemViewModel;
  vocabulary: VocabularyViewerViewModel;
  video: VideoItemViewModel;
  lectureMaterials: LectureMaterialsViewerViewModel;
  practice: PracticeItemViewModel;
  quiz?: QuizShellViewModel;
  resources?: ResourcesItemViewModel;
  practiceExample?: RevealExampleProps;
  completionAction: ReturnType<typeof nextActionForLesson>;
}


const SELECTED_A_QUIZ_LABELS: QuizShellViewModel["labels"] = {
  title: "Пять вопросов",
  instructions: "Выберите по одному варианту ответа на каждый вопрос.",
  selectedCountSuffix: "выбрано",
  preSubmitMessage: "После выбора всех вариантов отправьте ответы.",
  submittedMessage: "Ответы отправлены.",
  submitButton: "Отправить ответы",
};

function selectedAQuizViewModel(lesson: Lesson): QuizShellViewModel | undefined {
  const quiz = quizByLesson[lesson.code];
  if (!quiz) return undefined;
  return {
    labels: SELECTED_A_QUIZ_LABELS,
    questions: quiz.questions.map((question, questionIndex) => ({
      id: question.id,
      order: questionIndex + 1,
      displayOrder: String(questionIndex + 1).padStart(2, "0"),
      text: question.questionText,
      options: question.options.map((option, optionIndex) => ({
        id: option.id,
        order: optionIndex + 1,
        displayLabel: String.fromCharCode(65 + optionIndex),
        text: option.text,
      })),
    })),
  };
}

const SELECTED_A_PROJECT_01_EXAMPLE: RevealExampleProps = {
  src: "/prototype-assets/m01-project-01-preview.png",
  alt: "Реальный пример Project 01 Space Reading Board",
  width: 2001,
  height: 1125,
  caption: "Project 01 — Space Reading Board",
};
const SELECTED_A_PROJECT_02_EXAMPLE: RevealExampleProps = {
  src: "/prototype-assets/m02-project-02-preview.png",
  alt: "Реальный пример Project 02 Style Detective Case Study",
  width: 1920,
  height: 1080,
  caption: "Project 02 — Style Detective Case Study",
};
const SELECTED_A_PROJECT_03_EXAMPLE: RevealExampleProps = {
  src: "/prototype-assets/m03-project-03-preview.png",
  alt: "Реальный пример Project 03 Climate Response Diagram",
  width: 1920,
  height: 1080,
  caption: "Project 03 — Climate Response Diagram",
};
const SELECTED_A_PROJECT_04_EXAMPLE: RevealExampleProps = {
  src: "/prototype-assets/m04-project-04-preview.png",
  alt: "Реальный пример Project 04 Structure Exploded Axonometric",
  width: 1920,
  height: 1080,
  caption: "Project 04 — Structure Exploded Axonometric",
};
const SELECTED_A_PROJECT_05_EXAMPLE: RevealExampleProps = {
  src: "/prototype-assets/m05-project-05-preview.png",
  alt: "Реальный пример Project 05 Material Strategy Board",
  width: 1920,
  height: 1080,
  caption: "Project 05 — Material Strategy Board",
};
const SELECTED_A_PROJECT_06_EXAMPLE: RevealExampleProps = {
  src: "/prototype-assets/m06-project-06-preview.png",
  alt: "Реальный пример Project 06 Mini LEED-Inspired Strategy",
  width: 1920,
  height: 1080,
  caption: "Project 06 — Mini LEED-Inspired Strategy",
};
const SELECTED_A_PROJECT_07_EXAMPLE: RevealExampleProps = {
  src: "/prototype-assets/m07-project-07-preview.png",
  alt: "Реальный пример Project 07 Resilient Building Upgrade",
  width: 1920,
  height: 1080,
  caption: "Project 07 — Resilient Building Upgrade",
};

export function selectedAProjectExample(moduleCode: string): RevealExampleProps | undefined {
  const code = moduleCode.toUpperCase();
  return code === "M01" ? SELECTED_A_PROJECT_01_EXAMPLE
    : code === "M02" ? SELECTED_A_PROJECT_02_EXAMPLE
      : code === "M03" ? SELECTED_A_PROJECT_03_EXAMPLE
        : code === "M04" ? SELECTED_A_PROJECT_04_EXAMPLE
          : code === "M05" ? SELECTED_A_PROJECT_05_EXAMPLE
            : code === "M06" ? SELECTED_A_PROJECT_06_EXAMPLE
              : code === "M07" ? SELECTED_A_PROJECT_07_EXAMPLE
                : undefined;
}

export function selectedALessonMapping(lesson: Lesson, item: ItemId): SelectedALessonMapping {
  const definition = ITEMS.find((entry) => entry.id === item) ?? { ru: "Слайды и транскрипт", en: "Slides & Transcript" };
  const list = itemsFor(lesson);
  const index = list.findIndex((entry) => entry.id === item);
  const previous = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;
  const completionAction = nextActionForLesson(lesson);
  const itemIndex = ITEMS.findIndex((entry) => entry.id === item);
  const lessonDisplayCode = lesson.code.replace("_", " · ");
  const practiceOutput = lesson.miniOutput;
  const assets = getLessonPrototypeAssets(lesson.code);
  const vocabularyAssets = assets?.vocabulary;
  const lectureAssets = assets?.lectureMaterials;
  const moduleData = getImportedModuleData(lesson.moduleCode);
  if (!moduleData) throw new Error(`No imported selected-A module data for ${lesson.moduleCode}.`);
  const youtubeVideo = moduleData.youtubeVideos[lesson.code];
  const moduleCode = moduleData.module.code;

  return {
    workspace: {
      courseTree: {
        ariaLabel: "Содержание курса",
        module: { code: moduleCode, titleRu: moduleData.module.titleRu, titleEn: moduleData.module.titleEn },
        lessons: moduleData.lessons.map((entry) => {
          const open = entry.code === lesson.code;
          return {
            code: entry.code,
            shortCode: entry.code.slice(-3).replace("_", ""),
            titleRu: entry.titleRu,
            href: pathItem(moduleCode, entry.code, "overview"),
            status: statusForLesson(courseLessons.find((record) => record.code === entry.code) ?? courseLessons[0]!),
            open,
            items: open ? itemsFor(entry).map((itemDefinition, itemPosition) => ({
              id: itemDefinition.id,
              title: itemDefinition.ru,
              href: pathItem(moduleCode, entry.code, itemDefinition.id),
              state: itemDefinition.id === item ? "current" : itemPosition < itemIndex ? "completed" : "future",
            })) : [],
          };
        }),
        project: { code: `P${moduleCode.slice(1)}`, titleRu: moduleData.project.titleRu, href: pathProject(moduleCode) },
      },
      header: {
        breadcrumbs: {
          course: { label: "Курс", href: pathCourse },
          module: { label: moduleCode, href: pathModule(moduleCode) },
          lesson: { label: lessonDisplayCode, href: pathItem(moduleCode, lesson.code, "overview") },
          activeItemLabel: definition.ru,
        },
        lessonDisplayCode,
        activeItemTitleRu: definition.ru,
        activeItemTitleEn: definition.en,
        lessonTitleRu: lesson.titleRu,
        lessonTitleEn: lesson.titleEn,
      },
      pager: {
        previous: previous ? { contextLabel: "Предыдущий пункт", displayLabel: `← ${previous.ru}`, href: pathItem(moduleCode, lesson.code, previous.id) } : undefined,
        next: next
          ? { contextLabel: "Следующий пункт", displayLabel: `${next.ru} →`, href: pathItem(moduleCode, lesson.code, next.id) }
          : { contextLabel: completionAction.context === "project" ? "Следующий этап" : "Следующий урок", displayLabel: `${completionAction.label} →`, href: completionAction.href },
      },
      contents: {
        triggerIcon: "☰",
        triggerLabel: "СОДЕРЖАНИЕ КУРСА",
        triggerSummary: `${lessonDisplayCode} · ${definition.ru}`,
        drawerEyebrow: `${moduleCode} · ${lesson.code.slice(-3).replace("_", "")}`,
        drawerTitle: "Содержание курса",
        drawerAriaLabel: "Содержание курса",
        drawerCloseLabel: "Закрыть содержание курса",
      },
    },
    overview: {
      lessonTitleRu: lesson.titleRu,
      lessonTitleEn: lesson.titleEn,
      objective: lesson.objective,
      duration: { label: "Оценка времени", value: "20–25 минут + практика" },
      itemCount: { label: "Пунктов урока", value: list.length },
      outcomeCount: { label: "Результатов", value: lesson.learningOutcomes.length },
      startAction: { label: "Начать урок", href: pathItem(moduleCode, lesson.code, "vocabulary") },
      outcomes: lesson.learningOutcomes.map(({ order, label, text }) => ({ order, label, text })),
      route: list.map((entry, routeIndex) => ({
        order: routeIndex + 1,
        titleRu: entry.ru,
        titleEn: entry.en,
        summary: entry.summary,
        action: { label: "Открыть", href: pathItem(moduleCode, lesson.code, entry.id) },
      })),
    },
    vocabulary: {
      lessonCode: lesson.code,
      lessonDisplayCode: lesson.code.replace("_", " "),
      entries: lesson.vocabularyEntries.map(({ number, termEn, termRu, sourcePage }) => ({ number, termEn, termRu, sourcePage })),
      material: vocabularyAssets ? {
        pdfPath: vocabularyAssets.pdf,
        pageImagePaths: vocabularyAssets.pages,
        pageWidth: vocabularyAssets.pageWidth,
        pageHeight: vocabularyAssets.pageHeight,
      } : undefined,
      pendingMaterialMessage: PENDING_MATERIAL_MESSAGE,
    },
    video: {
      lessonDisplayCode,
      lessonTitleRu: lesson.titleRu,
      lessonTitleEn: lesson.titleEn,
      youtube: youtubeVideo ? {
        id: youtubeVideo.youtubeId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeVideo.youtubeId}`,
        watchUrl: youtubeVideo.youtubeUrl,
      } : undefined,
      pendingMediaMessage: PENDING_MATERIAL_MESSAGE,
      lectureMaterialsAction: {
        label: "Открыть слайды и транскрипт",
        href: pathItem(moduleCode, lesson.code, "lecture-materials"),
      },
    },
    lectureMaterials: {
      lessonTitleRu: lesson.titleRu,
      transcriptSections: lesson.transcript.sections.map(({ id, order, text }) => ({ id, order, text })),
      transcriptSectionCount: lesson.transcript.sectionCount,
      slides: lectureAssets ? {
        paths: lectureAssets.slides,
        width: lectureAssets.slideWidth,
        height: lectureAssets.slideHeight,
        presentationPdfPath: lectureAssets.pdf,
      } : undefined,
      pendingMaterialMessage: PENDING_MATERIAL_MESSAGE,
    },
    practice: {
      titleRu: practiceOutput.title.ru,
      titleEn: practiceOutput.title.en,
      purpose: practiceOutput.purpose,
      status: practiceOutput.status,
      estimatedTime: practiceOutput.estimatedTime,
      toolsHeading: practiceOutput.tools[0] ?? "",
      tools: practiceOutput.tools.slice(1).filter((tool) => !tool.endsWith(":")),
      studentTask: practiceOutput.studentTask,
      orderedSteps: practiceOutput.orderedSteps.map(({ order, text }) => ({ order, text })),
      selfCheck: practiceOutput.selfCheck.map((check) => check.replace(/^\[ \]\s*/, "")),
    },
    quiz: selectedAQuizViewModel(lesson),
    resources: lesson.resources.length ? { title: "Дополнительные материалы" } : undefined,
    practiceExample: assets?.practiceExample ? {
      src: assets.practiceExample.src,
      alt: assets.practiceExample.alt,
      width: assets.practiceExample.width,
      height: assets.practiceExample.height,
      caption: assets.practiceExample.caption,
    } : undefined,
    completionAction,
  };
}
