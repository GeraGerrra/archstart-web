import "server-only";

import type { DashboardViewModel } from "@/src/learning/types";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { isProjectSubmissionStatus } from "@/src/project-workspace/policy";
import type { ProjectCode, ProjectSubmissionStatus } from "@/src/project-workspace/types";
import type { SelectedAShellProgressProjection } from "@/src/prototypes/selected-a/shell-adapter";
import { hasActiveProjectStaffRole } from "./dashboard-project-staff-projection";
import { buildCourseProgressProjection } from "@/src/progress/course-progress";
import {
  courseLessons,
  courseModules,
  pathCourse,
  pathItem,
  pathModule,
  pathProject,
  moduleProject,
} from "@/src/prototypes/selected-a/data";

const LESSON_CODE_PATTERN = /^M0[1-8]_L0[1-5]$/u;
const MODULE_CODE_PATTERN = /^M0[1-8]$/u;

const STORED_ITEM_LABELS = {
  overview: "Обзор",
  vocabulary: "Словарь",
  video: "Видео",
  "lecture-materials": "Слайды и транскрипт",
  practice: "Практика",
  quiz: "Квиз",
} as const;

type StoredLessonItem = keyof typeof STORED_ITEM_LABELS;

type SessionClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

interface LessonActivityRow {
  lesson_code: string;
  last_item: StoredLessonItem;
  started_at: string;
  last_visited_at: string;
}

interface QuizAttemptRow {
  lesson_code: string;
  score: number;
  question_count: number;
  submitted_at: string;
}

interface LessonCompletionRow {
  lesson_code: string;
  completed_at: string;
}

interface ModuleCompletionRow {
  module_code: string;
  completed_at: string;
}

interface ProjectSubmissionRow {
  project_code: ProjectCode;
  current_status: ProjectSubmissionStatus;
}

const PROJECT_STATUS_LABELS: Readonly<Record<"none" | ProjectSubmissionStatus, string>> = {
  none: "Не начат",
  draft: "Черновик",
  submitted: "Отправлен",
  under_review: "На проверке",
  revisions_required: "Нужны правки",
  resubmitted: "Отправлен повторно",
  accepted: "Принят",
  not_accepted: "Не принят",
};

export interface DashboardProjection {
  model: DashboardViewModel;
  shellProgress: SelectedAShellProgressProjection;
}

function validLessonCode(value: unknown): value is string {
  return typeof value === "string" && LESSON_CODE_PATTERN.test(value);
}

function validModuleCode(value: unknown): value is string {
  return typeof value === "string" && MODULE_CODE_PATTERN.test(value);
}

function validStoredItem(value: unknown): value is StoredLessonItem {
  return typeof value === "string" && value in STORED_ITEM_LABELS;
}

function asLessonActivityRows(value: unknown): LessonActivityRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is LessonActivityRow => {
    if (!row || typeof row !== "object") return false;
    const record = row as Record<string, unknown>;
    return validLessonCode(record.lesson_code)
      && validStoredItem(record.last_item)
      && typeof record.started_at === "string"
      && typeof record.last_visited_at === "string";
  });
}

function asLatestQuizAttempt(value: unknown): QuizAttemptRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!validLessonCode(record.lesson_code)
    || typeof record.score !== "number"
    || typeof record.question_count !== "number"
    || typeof record.submitted_at !== "string") {
    return null;
  }
  return {
    lesson_code: record.lesson_code,
    score: record.score,
    question_count: record.question_count,
    submitted_at: record.submitted_at,
  };
}

function asLessonCompletionRows(value: unknown): LessonCompletionRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is LessonCompletionRow => {
    if (!row || typeof row !== "object") return false;
    const record = row as Record<string, unknown>;
    return validLessonCode(record.lesson_code)
      && typeof record.completed_at === "string";
  });
}

function asModuleCompletionRows(value: unknown): ModuleCompletionRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is ModuleCompletionRow => {
    if (!row || typeof row !== "object") return false;
    const record = row as Record<string, unknown>;
    return validModuleCode(record.module_code)
      && typeof record.completed_at === "string";
  });
}

function asProjectSubmissionRows(value: unknown): ProjectSubmissionRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is ProjectSubmissionRow => {
    if (!row || typeof row !== "object") return false;
    const record = row as Record<string, unknown>;
    return typeof record.project_code === "string"
      && /^M0[1-8]_P0[1-8]$/u.test(record.project_code)
      && isProjectSubmissionStatus(record.current_status);
  });
}

function displayLessonCode(lessonCode: string): string {
  return `${lessonCode.slice(0, 3)} · ${lessonCode.slice(4)}`;
}

function actionLabel(item: StoredLessonItem): string {
  switch (item) {
    case "overview":
      return "Открыть урок";
    case "vocabulary":
      return "Продолжить со словаря";
    case "video":
      return "Продолжить с видео";
    case "lecture-materials":
      return "Продолжить со слайдов";
    case "practice":
      return "Продолжить с практики";
    case "quiz":
      return "Продолжить с квиза";
  }
}

function nextIncompleteLessonCode(
  anchorCode: string,
  orderedLessonCodes: readonly string[],
  completedLessonCodes: ReadonlySet<string>,
): string | null {
  const anchorIndex = orderedLessonCodes.indexOf(anchorCode);
  const afterAnchor = anchorIndex >= 0
    ? orderedLessonCodes.slice(anchorIndex + 1)
    : orderedLessonCodes;
  return afterAnchor.find((code) => !completedLessonCodes.has(code))
    ?? orderedLessonCodes.find((code) => !completedLessonCodes.has(code))
    ?? null;
}

async function authenticatedSession(): Promise<{
  client: SessionClient;
  userId: string;
}> {
  const client = await createServerSupabaseClient();
  const { data: claimsResult, error: claimsError } = await client.auth.getClaims();
  const userId = typeof claimsResult?.claims?.sub === "string"
    ? claimsResult.claims.sub
    : "";

  if (claimsError || !userId) {
    throw new Error("Authenticated Dashboard session required.");
  }

  return { client, userId };
}

export async function loadDashboardProjection(
  firstName: string | null | undefined,
): Promise<DashboardProjection> {
  const { client, userId } = await authenticatedSession();

  const [activityResult, latestAttemptResult, lessonCompletionResult, moduleCompletionResult, projectResult, hasStaffRole] = await Promise.all([
    client
      .from("lesson_activity")
      .select("lesson_code,last_item,started_at,last_visited_at")
      .eq("user_id", userId)
      .order("last_visited_at", { ascending: false }),
    client
      .from("quiz_attempts")
      .select("lesson_code,score,question_count,submitted_at")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("lesson_completions")
      .select("lesson_code,completed_at")
      .eq("user_id", userId),
    client
      .from("module_completions")
      .select("module_code,completed_at")
      .eq("user_id", userId),
    client
      .from("project_submissions")
      .select("project_code,current_status"),
    hasActiveProjectStaffRole(userId),
  ]);

  if (activityResult.error
    || latestAttemptResult.error
    || lessonCompletionResult.error
    || moduleCompletionResult.error
    || projectResult.error) {
    throw new Error("Unable to load signed-in Dashboard projection.");
  }

  const activities = asLessonActivityRows(activityResult.data);
  const latestAttempt = asLatestQuizAttempt(latestAttemptResult.data);
  const lessonCompletions = asLessonCompletionRows(lessonCompletionResult.data);
  const moduleCompletions = asModuleCompletionRows(moduleCompletionResult.data);
  const projectSubmissions = asProjectSubmissionRows(projectResult.data);
  const projectStatusByCode = new Map(
    projectSubmissions.map((submission) => [submission.project_code, submission.current_status]),
  );

  const orderedLessons = [...courseLessons].sort(
    (left, right) => left.globalOrder - right.globalOrder,
  );
  const orderedLessonCodes = orderedLessons.map((lesson) => lesson.code);
  const lessonByCode = new Map(orderedLessons.map((lesson) => [lesson.code, lesson]));
  const completedLessonCodes = new Set(lessonCompletions.map((row) => row.lesson_code));
  const moduleCompletionRowCodes = new Set(moduleCompletions.map((row) => row.module_code));
  const latestActivity = activities[0] ?? null;
  const latestLessonCompletion = [...lessonCompletions].sort(
    (left, right) => right.completed_at.localeCompare(left.completed_at),
  )[0] ?? null;

  let continueLessonCode: string | null = null;
  let continueItem: StoredLessonItem = "overview";

  if (latestActivity && !completedLessonCodes.has(latestActivity.lesson_code)) {
    continueLessonCode = latestActivity.lesson_code;
    continueItem = latestActivity.last_item;
  } else if (latestActivity) {
    continueLessonCode = nextIncompleteLessonCode(
      latestActivity.lesson_code,
      orderedLessonCodes,
      completedLessonCodes,
    );
  } else if (latestAttempt && !completedLessonCodes.has(latestAttempt.lesson_code)) {
    continueLessonCode = latestAttempt.lesson_code;
    continueItem = "quiz";
  } else if (latestAttempt) {
    continueLessonCode = nextIncompleteLessonCode(
      latestAttempt.lesson_code,
      orderedLessonCodes,
      completedLessonCodes,
    );
  } else {
    continueLessonCode = orderedLessonCodes.find(
      (code) => !completedLessonCodes.has(code),
    ) ?? null;
  }

  const continueLesson = continueLessonCode
    ? lessonByCode.get(continueLessonCode) ?? null
    : null;
  const activityLesson = latestActivity
    ? lessonByCode.get(latestActivity.lesson_code) ?? null
    : null;
  const attemptLesson = latestAttempt
    ? lessonByCode.get(latestAttempt.lesson_code) ?? null
    : null;
  const completionLesson = latestLessonCompletion
    ? lessonByCode.get(latestLessonCompletion.lesson_code) ?? null
    : null;

  const activeLessonCodes = new Set(
    activities
      .map((row) => row.lesson_code)
      .filter((code) => !completedLessonCodes.has(code)),
  );
  if (latestAttempt && !completedLessonCodes.has(latestAttempt.lesson_code)) {
    activeLessonCodes.add(latestAttempt.lesson_code);
  }

  const sharedProgress = buildCourseProgressProjection({
    authenticated: true,
    completedLessonCodes: [...completedLessonCodes],
    activeLessonCodes: [...activeLessonCodes],
    moduleCompletionRowCodes: [...moduleCompletionRowCodes],
    projectSubmissions,
    latestActivityLessonCode: latestActivity?.lesson_code ?? null,
  });
  const completedModuleCodes = new Set(sharedProgress.completedModuleCodes);
  const shellProgress: SelectedAShellProgressProjection = {
    authenticated: true,
    completedLessonCodes: sharedProgress.completedLessonCodes,
    completedModuleCodes: sharedProgress.completedModuleCodes,
    activeLessonCodes: sharedProgress.activeLessonCodes,
    projectStatuses: sharedProgress.projectStatuses,
    currentModuleCode: continueLesson?.moduleCode ?? sharedProgress.currentModuleCode,
  };

  const learnerName = firstName?.trim() || "участник";
  const hasHistory = activities.length > 0
    || latestAttempt !== null
    || completedLessonCodes.size > 0
    || moduleCompletionRowCodes.size > 0;

  const historyLesson = activityLesson ?? attemptLesson ?? completionLesson ?? continueLesson;
  const historyItemLabel = latestActivity
    ? STORED_ITEM_LABELS[latestActivity.last_item]
    : latestAttempt
      ? "Квиз"
      : latestLessonCompletion
        ? "Завершение урока"
        : "—";

  const model: DashboardViewModel = {
    title: `С возвращением, ${learnerName}.`,
    disclosure: "Это прогресс только вашего аккаунта. Квиз сохраняет попытку, а завершение учитывается после явной отметки.",
    profileAction: { label: "Профиль и выход", href: "/profile" },
    completedLessons: completedLessonCodes.size,
    lessonTotal: orderedLessonCodes.length,
    continueLearning: continueLesson
      ? {
          code: displayLessonCode(continueLesson.code),
          titleRu: continueLesson.titleRu,
          titleEn: continueLesson.titleEn,
          action: {
            label: actionLabel(continueItem),
            href: pathItem(
              continueLesson.moduleCode,
              continueLesson.code,
              continueItem,
            ),
          },
        }
      : {
          code: "40 / 40",
          titleRu: "Все уроки завершены",
          titleEn: "All lessons completed",
          action: { label: "Открыть карту курса", href: pathCourse },
        },
    moduleMapTitle: "Позиция в курсе",
    modules: courseModules.map((module) => {
      const completedLessons = orderedLessons.filter(
        (lesson) => lesson.moduleCode === module.code
          && completedLessonCodes.has(lesson.code),
      ).length;
      const hasModuleActivity = [...activeLessonCodes].some(
        (lessonCode) => lessonCode.startsWith(`${module.code}_`),
      );
      const moduleComplete = completedModuleCodes.has(module.code);
      const progressLabel = moduleComplete
        ? "Завершён"
        : completedLessons > 0
          ? `${completedLessons} из 5 уроков`
          : hasModuleActivity
            ? "Начат"
            : "Не начат";

      return {
        code: module.code,
        titleRu: module.titleRu,
        titleEn: module.titleEn,
        completedLessons,
        lessonTotal: 5,
        progressLabel,
        action: { label: "Открыть", href: pathModule(module.code) },
      };
    }),
    emptyHistory: hasHistory
      ? {
          title: "Последняя активность",
          description: "Показываем только сохранённые действия этого аккаунта.",
          records: [
            {
              label: "Урок",
              value: historyLesson
                ? `${displayLessonCode(historyLesson.code)} · ${historyLesson.titleRu}`
                : "—",
            },
            {
              label: "Пункт",
              value: historyItemLabel,
            },
            {
              label: "Последний квиз",
              value: latestAttempt
                ? `${latestAttempt.score} из ${latestAttempt.question_count}`
                : "пока нет",
            },
            {
              label: "Завершено",
              value: `${completedLessonCodes.size} из ${orderedLessonCodes.length}`,
            },
          ],
        }
      : {
          title: "Истории пока нет",
          description: "Откройте первый урок — здесь появится последнее сохранённое место.",
          records: [
            { label: "Уроки", value: `0 из ${orderedLessonCodes.length}` },
            { label: "Модули", value: `0 из ${courseModules.length}` },
          ],
        },
    projects: courseModules.map((module) => {
      const project = moduleProject(module.code);
      if (!project) throw new Error(`Project display record is missing for ${module.code}.`);
      const status = projectStatusByCode.get(project.code as ProjectCode) ?? "none";
      return {
        projectCode: project.code,
        titleRu: project.titleRu,
        status,
        statusLabel: PROJECT_STATUS_LABELS[status],
        action: { label: "Открыть", href: pathProject(module.code) },
      };
    }),
    staffReviewAction: hasStaffRole
      ? { label: "Проверка проектов", href: "/prototype/a/review" }
      : undefined,
  };

  return { model, shellProgress };
}
