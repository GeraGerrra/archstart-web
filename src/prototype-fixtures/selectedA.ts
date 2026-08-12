/**
 * Development-only, display-safe showcase fixtures.
 *
 * These records are not learner accounts, persisted progress, content-engine
 * records or selected-A production mappings. They contain only public display
 * copy and approved browser asset paths for /dev/design-system.
 */
import type {
  HeaderLabels,
  ModuleNavigationItem,
  ModuleNavigationLabels,
  ShellBrand,
  ShellNavigationItem,
} from "@/src/app-shell";
import type {
  CourseOverviewViewModel,
  CourseTreeViewModel,
  LessonHeaderViewModel,
  LessonPagerViewModel,
  ModuleOverviewViewModel,
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
import type { CompletionDemoState, CutoutCompletionViewModel } from "@/src/completion";

const SHOWCASE_HREF = "/dev/design-system";
const PROTOTYPE_COURSE_HREF = "/course";
const PROTOTYPE_MODULE_HREF = "/course/m01";
const PROTOTYPE_LESSON_HREF = "/course/m01/l01/overview";

export const showcaseBrand: ShellBrand = {
  href: SHOWCASE_HREF,
  ariaLabel: "ARCH.START, витрина дизайн-системы",
  wordmark: {
    src: "/prototype-assets/archstart-wordmark-tight.png",
    alt: "ARCH.START",
    width: 1000,
    height: 138,
  },
};

export const showcaseNavigationItems: readonly ShellNavigationItem[] = [
  { id: "overview", label: "Обзор", href: `${SHOWCASE_HREF}#overview` },
  { id: "components", label: "Компоненты", href: `${SHOWCASE_HREF}#components` },
  { id: "states", label: "Состояния", href: `${SHOWCASE_HREF}#states` },
];

export const showcaseHeaderLabels: HeaderLabels = {
  primaryNavigationAriaLabel: "Навигация витрины",
  mobileTriggerLabel: "МЕНЮ",
  mobileDrawerAriaLabel: "Мобильная навигация витрины",
  mobileDrawerEyebrow: "DEVELOPMENT ONLY",
  mobileDrawerTitle: "Design system",
  mobileCloseLabel: "Закрыть мобильную навигацию",
  mobileLinksAriaLabel: "Разделы витрины",
};

export const showcaseModuleLabels: ModuleNavigationLabels = {
  stripLabel: "МОДУЛИ",
  desktopAriaLabel: "Демонстрационные модули",
  mobileDialogAriaLabel: "Демонстрационный список модулей",
  mobileCourseEyebrow: "COMPONENT STATE",
  mobileModuleCountLabel: "8 модулей",
  mobileCloseLabel: "Закрыть демонстрационный список модулей",
  modulePanelAriaLabelPrefix: "Демонстрационное содержание",
  lessonCountSuffix: "уроков",
  openLessonLabel: "Открыть",
  openModuleLabel: "Открыть модуль",
  modulePageLabel: "Страница модуля",
};

const moduleTitles = [
  ["Пространство, масштаб, функция", "Space, Scale, Function"],
  ["История и стили", "History and Styles"],
  ["Участок и климат", "Site and Climate"],
  ["Конструкции", "Structures"],
  ["Материалы", "Materials"],
  ["Устойчивые стратегии", "Sustainable Strategies"],
  ["Риски и устойчивость", "Risk and Resilience"],
  ["Презентация проекта", "Project Presentation"],
] as const;

export const showcaseModules: readonly ModuleNavigationItem[] = moduleTitles.map(([titleRu, titleEn], index) => {
  const number = String(index + 1).padStart(2, "0");
  const code = `M${number}`;
  const firstModule = index === 0;
  return {
    code,
    titleRu,
    titleEn,
    href: firstModule ? PROTOTYPE_MODULE_HREF : PROTOTYPE_COURSE_HREF,
    lessons: Array.from({ length: 5 }, (_, lessonIndex) => {
      const lessonNumber = String(lessonIndex + 1).padStart(2, "0");
      return {
        code: `${code}_L${lessonNumber}`,
        displayCode: `${code} · L${lessonNumber}`,
        shortCode: `L${lessonNumber}`,
        titleRu: lessonIndex === 0 ? "Как читать архитектурное пространство" : `Демонстрационный урок ${lessonNumber}`,
        href: firstModule ? PROTOTYPE_LESSON_HREF : undefined,
        status: firstModule && lessonIndex === 0 ? "in-progress" : index === 3 ? "complete" : index < 2 ? "available" : "locked",
        quietStatusLabel: index < 2 ? "Доступен" : index === 3 ? "Завершён" : "Закрыт",
      };
    }),
    project: {
      code: `P${number}`,
      titleRu: `Проект модуля ${number}`,
      href: firstModule ? `${PROTOTYPE_MODULE_HREF}/project` : undefined,
      status: index === 3 ? "complete" : index < 2 ? "available" : "locked",
    },
    completedLessonCount: index === 3 ? 5 : firstModule ? 2 : 0,
    lessonTotal: 5,
    status: index === 3 ? "complete" : firstModule ? "in-progress" : index === 1 ? "available" : "locked",
  };
});

export const showcaseCourseOverview: CourseOverviewViewModel = {
  title: "Курс ARCH.START",
  summary: "Репрезентативное состояние заголовка и сводки курса для проверки публичного компонента.",
  demoDisclosure: "Демонстрационные числа не являются данными пользователя и не сохраняются.",
  continueAction: { label: "Открыть M01 · L01", href: PROTOTYPE_LESSON_HREF },
  totals: {
    completedLessons: 2,
    lessonTotal: 40,
    completedModules: 0,
    moduleTotal: 8,
    completedProjects: 0,
    projectTotal: 8,
    quizQuestions: 200,
  },
  moduleListTitle: "Репрезентативный модуль",
  modules: [
    {
      code: "M01",
      titleRu: "Пространство, масштаб, функция",
      titleEn: "Space, Scale, Function",
      goal: "Научиться читать архитектурное пространство как систему решений.",
      href: PROTOTYPE_MODULE_HREF,
      status: "in-progress",
      completedLessons: 2,
      lessonTotal: 5,
      cutout: {
        src: "/prototype-assets/module-m01-cutout.png",
        alt: "",
        width: 2816,
        height: 1536,
      },
      lessons: [
        {
          code: "M01_L01",
          shortCode: "L01",
          titleRu: "Как читать архитектурное пространство",
          status: "in-progress",
          action: { label: "Открыть", href: PROTOTYPE_LESSON_HREF },
        },
      ],
      project: { code: "P01", titleRu: "Space Reading Board", status: "available" },
    },
  ],
};

export const showcaseModuleOverview: ModuleOverviewViewModel = {
  code: "M01",
  titleRu: "Пространство, масштаб, функция",
  titleEn: "Space, Scale, Function",
  goal: "Репрезентативное состояние заголовка, прогресса и структуры модуля.",
  cutout: {
    src: "/prototype-assets/module-m01-cutout.png",
    alt: "",
    width: 2816,
    height: 1536,
  },
  completedLessons: 2,
  lessonTotal: 5,
  outcomes: [
    { order: 1, label: "Наблюдать", text: "Выделять границы, движение, масштаб и свет." },
  ],
  lessons: [
    {
      code: "M01_L01",
      order: 1,
      titleRu: "Как читать архитектурное пространство",
      titleEn: "How to Read Architectural Space",
      objective: "Разобрать пространство через пять наблюдаемых слоёв.",
      status: "in-progress",
      items: [
        { id: "overview", titleRu: "Обзор", titleEn: "Overview", action: { label: "Открыть", href: PROTOTYPE_LESSON_HREF } },
      ],
    },
  ],
  project: {
    code: "P01",
    titleRu: "Space Reading Board",
    titleEn: "Space Reading Board",
    objective: "Собрать наблюдения в один аналитический планшет.",
    status: "available",
    action: { label: "Открыть проект", href: `${PROTOTYPE_MODULE_HREF}/project` },
  },
};

export const showcaseCourseTree: CourseTreeViewModel = {
  ariaLabel: "Демонстрационное содержание курса",
  module: {
    code: "M01",
    titleRu: "Пространство, масштаб, функция",
    titleEn: "Space, Scale, Function",
  },
  lessons: [
    {
      code: "M01_L01",
      shortCode: "L01",
      titleRu: "Как читать архитектурное пространство",
      href: PROTOTYPE_LESSON_HREF,
      status: "in-progress",
      open: true,
      items: [
        { id: "overview", title: "Обзор", href: PROTOTYPE_LESSON_HREF, state: "completed" },
        { id: "practice", title: "Практика", href: `${PROTOTYPE_MODULE_HREF}/l01/practice`, state: "current" },
        { id: "quiz", title: "Квиз", href: `${PROTOTYPE_MODULE_HREF}/l01/quiz`, state: "future" },
      ],
    },
    {
      code: "M01_L02",
      shortCode: "L02",
      titleRu: "Масштаб и человеческое восприятие",
      href: `${PROTOTYPE_MODULE_HREF}/l02/overview`,
      status: "available",
      open: false,
      items: [],
    },
  ],
  project: {
    code: "P01",
    titleRu: "Space Reading Board",
    href: `${PROTOTYPE_MODULE_HREF}/project`,
  },
};

export const showcaseLessonHeader: LessonHeaderViewModel = {
  breadcrumbs: {
    course: { label: "Курс", href: PROTOTYPE_COURSE_HREF },
    module: { label: "M01", href: PROTOTYPE_MODULE_HREF },
    lesson: { label: "M01 · L01", href: PROTOTYPE_LESSON_HREF },
    activeItemLabel: "Практика",
  },
  lessonDisplayCode: "M01 · L01",
  activeItemTitleRu: "Практика",
  activeItemTitleEn: "Practice",
  lessonTitleRu: "Как читать архитектурное пространство",
  lessonTitleEn: "How to Read Architectural Space",
};

export const showcaseLongLessonHeader: LessonHeaderViewModel = {
  ...showcaseLessonHeader,
  breadcrumbs: {
    ...showcaseLessonHeader.breadcrumbs,
    activeItemLabel: "Сверхдлинный заголовок",
  },
  activeItemTitleRu: "Сверхдлинный русский заголовок для проверки переноса, ритма и устойчивости композиции на узких экранах",
  activeItemTitleEn: "Long Russian Heading Stress Case",
};

export const showcaseLessonPager: LessonPagerViewModel = {
  previous: {
    contextLabel: "Предыдущий пункт",
    displayLabel: "← Слайды и транскрипт",
    href: `${PROTOTYPE_MODULE_HREF}/l01/lecture-materials`,
  },
  next: {
    contextLabel: "Следующий пункт",
    displayLabel: "Квиз →",
    href: `${PROTOTYPE_MODULE_HREF}/l01/quiz`,
  },
};

export const showcaseOverview: OverviewItemViewModel = {
  lessonTitleRu: "Как читать архитектурное пространство",
  lessonTitleEn: "How to Read Architectural Space",
  objective: "Разобрать пространство через границы, движение, свет и масштаб.",
  duration: { label: "Оценка времени", value: "20–25 минут + практика" },
  itemCount: { label: "Пунктов урока", value: 7 },
  outcomeCount: { label: "Результатов", value: 2 },
  startAction: { label: "Начать урок", href: `${PROTOTYPE_MODULE_HREF}/l01/vocabulary` },
  outcomes: [
    { order: 1, label: "Наблюдать", text: "Выделять пространственные границы и основные маршруты." },
    { order: 2, label: "Объяснять", text: "Связывать масштаб, свет и функцию с пользовательским опытом." },
  ],
  route: [
    { order: 1, titleRu: "Словарь", titleEn: "Vocabulary", summary: "Ключевые термины урока.", action: { label: "Открыть", href: `${PROTOTYPE_MODULE_HREF}/l01/vocabulary` } },
    { order: 2, titleRu: "Практика", titleEn: "Practice", summary: "Короткое наблюдение и схема.", action: { label: "Открыть", href: `${PROTOTYPE_MODULE_HREF}/l01/practice` } },
  ],
};

export const showcasePractice: PracticeItemViewModel = {
  titleRu: "Пятислойное чтение пространства",
  titleEn: "Five-layer Space Reading",
  purpose: "Собрать наблюдения в одну ясную аналитическую схему.",
  status: "Демонстрационный компонент",
  estimatedTime: "15–20 минут",
  toolsHeading: "Инструменты",
  tools: ["Фото пространства", "Лист A4", "Чёрный маркер"],
  studentTask: "Создайте схему из пяти наблюдаемых слоёв",
  orderedSteps: [
    { order: 1, text: "Отметьте границы и входы." },
    { order: 2, text: "Покажите маршрут движения." },
    { order: 3, text: "Добавьте свет, масштаб и функцию." },
  ],
  selfCheck: ["Границы читаются ясно", "Маршрут не конфликтует с подписями", "Каждый слой объяснён"],
};

export const showcaseResources: ResourcesItemViewModel = {
  title: "Дополнительные материалы",
};

export const showcaseVocabularyAvailable: VocabularyViewerViewModel = {
  lessonCode: "M01_L01",
  lessonDisplayCode: "M01 L01",
  entries: [
    { number: 1, termEn: "Boundary", termRu: "Граница", sourcePage: 1 },
    { number: 2, termEn: "Threshold", termRu: "Порог", sourcePage: 2 },
    { number: 3, termEn: "Circulation", termRu: "Движение", sourcePage: 3 },
  ],
  material: {
    pdfPath: "/prototype-assets/m01-l01-vocabulary.pdf",
    pageImagePaths: [
      "/prototype-assets/m01-l01-vocabulary-page-01.png",
      "/prototype-assets/m01-l01-vocabulary-page-02.png",
      "/prototype-assets/m01-l01-vocabulary-page-03.png",
    ],
    pageWidth: 1241,
    pageHeight: 1755,
  },
  pendingMaterialMessage: "Материал будет добавлен после публикации утверждённого файла.",
};

export const showcaseVocabularyPending: VocabularyViewerViewModel = {
  ...showcaseVocabularyAvailable,
  lessonCode: "M01_L02",
  lessonDisplayCode: "M01 L02",
  material: undefined,
};

export const showcaseVideoPending: VideoItemViewModel = {
  lessonDisplayCode: "M01 · L01",
  lessonTitleRu: "Как читать архитектурное пространство",
  lessonTitleEn: "How to Read Architectural Space",
  pendingMediaMessage: "Видео будет добавлено после публикации утверждённого файла.",
  lectureMaterialsAction: {
    label: "Открыть слайды и транскрипт",
    href: `${PROTOTYPE_MODULE_HREF}/l01/lecture-materials`,
  },
};

export const showcaseLectureAvailable: LectureMaterialsViewerViewModel = {
  lessonTitleRu: "Как читать архитектурное пространство",
  transcriptSections: [
    { id: "demo-transcript-01", order: 1, text: "Архитектурное пространство начинается с наблюдения за границами." },
    { id: "demo-transcript-02", order: 2, text: "Маршрут движения помогает увидеть функцию и последовательность." },
  ],
  transcriptSectionCount: 2,
  slides: {
    paths: [
      "/prototype-assets/m01-l01-slides/slide-01.png",
      "/prototype-assets/m01-l01-slides/slide-02.png",
    ],
    width: 1920,
    height: 1080,
    presentationPdfPath: "/prototype-assets/m01-l01-presentation.pdf",
  },
  pendingMaterialMessage: "Материал будет добавлен после публикации утверждённого файла.",
};

export const showcaseLecturePending: LectureMaterialsViewerViewModel = {
  ...showcaseLectureAvailable,
  slides: undefined,
};

export const showcaseRevealExample: RevealExampleProps = {
  src: "/prototype-assets/m01-l01-our-example.png",
  alt: "Демонстрационный пример пятислойной диаграммы",
  width: 2337,
  height: 1653,
  caption: "Компонентное состояние RevealExample",
};

export const showcaseQuiz: QuizShellViewModel = {
  labels: {
    title: "Пять вопросов",
    instructions: "Выберите по одному варианту ответа на каждый вопрос.",
    selectedCountSuffix: "выбрано",
    preSubmitMessage: "После выбора всех вариантов отправьте ответы.",
    submittedMessage: "Ответы отправлены.",
    submitButton: "Отправить ответы",
  },
  questions: Array.from({ length: 5 }, (_, questionIndex) => ({
    id: `showcase-question-${questionIndex + 1}`,
    order: questionIndex + 1,
    displayOrder: String(questionIndex + 1).padStart(2, "0"),
    text: `Демонстрационный вопрос ${questionIndex + 1}: какой вариант лучше описывает наблюдаемое пространственное качество?`,
    options: ["Граница", "Маршрут", "Свет", "Масштаб"].map((text, optionIndex) => ({
      id: `showcase-question-${questionIndex + 1}-option-${optionIndex + 1}`,
      order: optionIndex + 1,
      displayLabel: String.fromCharCode(65 + optionIndex),
      text,
    })),
  })),
};

const showcaseCutout = {
  src: "/prototype-assets/module-m01-cutout.png",
  alt: "",
  width: 2816,
  height: 1536,
} as const;

function completionFixture(kind: "lesson" | "module", initialState: CompletionDemoState): CutoutCompletionViewModel {
  const moduleMode = kind === "module";
  return {
    kind,
    segmentCode: "M01",
    cutout: showcaseCutout,
    initialState,
    lockedTitle: moduleMode ? "Завершение модуля" : "Завершение урока",
    lockedMessage: moduleMode
      ? "Завершите обязательные пункты модуля. После этого эскиз станет активным."
      : "Завершите обязательные пункты урока. После этого эскиз станет активным.",
    lockedLabel: moduleMode ? "Завершение модуля пока недоступно" : "Завершение урока пока недоступно",
    beforeTitle: moduleMode ? "Модуль готов к завершению" : "Вы дошли до конца урока",
    beforeMessage: moduleMode ? "Нажмите на эскиз, чтобы завершить M01." : "Нажмите на эскиз, чтобы отметить урок завершённым.",
    completedTitle: moduleMode ? "Модуль 01 завершён" : "Урок завершён",
    completedMessage: moduleMode ? "Пространство прочитано." : "Следующий урок доступен.",
    actionLabel: moduleMode ? "Завершить M01" : "Отметить урок завершённым",
    undoLabel: "Снять отметку",
    nextAction: moduleMode
      ? { href: "/course/m02", label: "Перейти к M02" }
      : { href: "/course/m01/l02/overview", label: "Перейти к M01 · L02" },
  };
}

export const showcaseLessonCompletionLocked = completionFixture("lesson", "locked");
export const showcaseLessonCompletionReady = completionFixture("lesson", "ready");
export const showcaseLessonCompletionComplete = completionFixture("lesson", "complete");
export const showcaseModuleCompletionLocked = completionFixture("module", "locked");
export const showcaseModuleCompletionReady = completionFixture("module", "ready");
export const showcaseModuleCompletionComplete = completionFixture("module", "complete");
