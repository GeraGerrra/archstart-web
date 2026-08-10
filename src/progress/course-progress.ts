import type { VisualStatus } from "@/src/design-system";
import { projectCodeForModule } from "../project-workspace/policy.ts";
import type {
  ProjectCode,
  ProjectSubmissionStatus,
} from "../project-workspace/types.ts";

export type CourseProjectStatus = "none" | ProjectSubmissionStatus;

export const COURSE_MODULE_CODES = Object.freeze(
  Array.from({ length: 8 }, (_, index) => `M${String(index + 1).padStart(2, "0")}`),
);

export const COURSE_LESSON_CODES = Object.freeze(
  COURSE_MODULE_CODES.flatMap((moduleCode) =>
    Array.from(
      { length: 5 },
      (_, index) => `${moduleCode}_L${String(index + 1).padStart(2, "0")}`,
    ),
  ),
);

export interface CourseProjectProgress {
  projectCode: ProjectCode;
  status: CourseProjectStatus;
}

/**
 * Serializable, read-only course progress projection shared by every
 * Selected-A production surface. Database module-completion rows remain
 * lesson-only evidence; completedModuleCodes means the product-level rule:
 * five lessons plus an accepted project.
 */
export interface CourseProgressProjection {
  authenticated: boolean;
  completedLessonCodes: readonly string[];
  activeLessonCodes: readonly string[];
  moduleCompletionRowCodes: readonly string[];
  lessonCompleteModuleCodes: readonly string[];
  completedModuleCodes: readonly string[];
  projectStatuses: readonly CourseProjectProgress[];
  currentModuleCode: string;
  continueLessonCode: string | null;
}

export interface CourseProjectSubmissionInput {
  project_code: ProjectCode;
  current_status: ProjectSubmissionStatus;
}

export interface CourseProgressProjectionInput {
  authenticated: boolean;
  completedLessonCodes: readonly string[];
  activeLessonCodes: readonly string[];
  moduleCompletionRowCodes: readonly string[];
  projectSubmissions: readonly CourseProjectSubmissionInput[];
  latestActivityLessonCode?: string | null;
}

export const COURSE_PROJECT_STATUS_LABELS: Readonly<
  Record<CourseProjectStatus, string>
> = {
  none: "Не начат",
  draft: "Черновик",
  submitted: "Отправлен",
  under_review: "На проверке",
  revisions_required: "Нужны правки",
  resubmitted: "Отправлен повторно",
  accepted: "Принят",
  not_accepted: "Не принят",
};

function emptyCourseProjectStatuses(): readonly CourseProjectProgress[] {
  return COURSE_MODULE_CODES.map((moduleCode) => {
    const projectCode = projectCodeForModule(moduleCode);
    if (!projectCode) {
      throw new Error(`Project code is unavailable for ${moduleCode}.`);
    }
    return { projectCode, status: "none" as const };
  });
}

export const ANONYMOUS_COURSE_PROGRESS_PROJECTION: CourseProgressProjection = {
  authenticated: false,
  completedLessonCodes: [],
  activeLessonCodes: [],
  moduleCompletionRowCodes: [],
  lessonCompleteModuleCodes: [],
  completedModuleCodes: [],
  projectStatuses: emptyCourseProjectStatuses(),
  currentModuleCode: "M01",
  continueLessonCode: "M01_L01",
};

export function buildCourseProgressProjection({
  authenticated,
  completedLessonCodes,
  activeLessonCodes,
  moduleCompletionRowCodes,
  projectSubmissions,
  latestActivityLessonCode = null,
}: CourseProgressProjectionInput): CourseProgressProjection {
  const completedLessonSet = new Set(completedLessonCodes);
  const orderedLessonCodes = COURSE_LESSON_CODES;
  const projectStatusByCode = new Map<ProjectCode, ProjectSubmissionStatus>(
    projectSubmissions.map((submission) => [
      submission.project_code,
      submission.current_status,
    ]),
  );
  const projectStatuses: readonly CourseProjectProgress[] = emptyCourseProjectStatuses().map((entry) => ({
    projectCode: entry.projectCode,
    status: projectStatusByCode.get(entry.projectCode) ?? "none",
  }));

  const lessonCompleteModuleCodes = COURSE_MODULE_CODES
    .filter((moduleCode) => COURSE_LESSON_CODES.filter(
      (lessonCode) => lessonCode.startsWith(`${moduleCode}_`)
        && completedLessonSet.has(lessonCode),
    ).length === 5);

  const acceptedProjectCodes = new Set(
    projectStatuses
      .filter((entry) => entry.status === "accepted")
      .map((entry) => entry.projectCode),
  );
  const completedModuleCodes = COURSE_MODULE_CODES
    .filter((moduleCode) => {
      const projectCode = projectCodeForModule(moduleCode);
      return lessonCompleteModuleCodes.includes(moduleCode)
        && Boolean(projectCode && acceptedProjectCodes.has(projectCode));
    });

  let continueLessonCode = orderedLessonCodes.find(
    (code) => !completedLessonSet.has(code),
  ) ?? null;
  if (latestActivityLessonCode && orderedLessonCodes.includes(latestActivityLessonCode)) {
    const latestIndex = orderedLessonCodes.indexOf(latestActivityLessonCode);
    if (!completedLessonSet.has(latestActivityLessonCode)) {
      continueLessonCode = latestActivityLessonCode;
    } else if (latestIndex >= 0) {
      continueLessonCode = orderedLessonCodes
        .slice(latestIndex + 1)
        .find((code) => !completedLessonSet.has(code))
        ?? continueLessonCode;
    }
  }

  return {
    authenticated,
    completedLessonCodes: [...completedLessonSet].sort(),
    activeLessonCodes: [...new Set(activeLessonCodes)].sort(),
    moduleCompletionRowCodes: [...new Set(moduleCompletionRowCodes)].sort(),
    lessonCompleteModuleCodes,
    completedModuleCodes,
    projectStatuses,
    currentModuleCode: continueLessonCode?.slice(0, 3)
      ?? latestActivityLessonCode?.slice(0, 3)
      ?? "M01",
    continueLessonCode,
  };
}

export function courseProjectVisualStatus(
  status: CourseProjectStatus,
): VisualStatus {
  if (status === "accepted") return "complete";
  if (status === "none") return "available";
  return "in-progress";
}

export function courseProjectStatusMap(
  projection: Pick<CourseProgressProjection, "projectStatuses">,
): ReadonlyMap<ProjectCode, CourseProjectStatus> {
  return new Map(
    projection.projectStatuses.map((entry) => [entry.projectCode, entry.status]),
  );
}

export function courseLessonVisualStatus(
  lessonCode: string,
  projection: Pick<
    CourseProgressProjection,
    "completedLessonCodes" | "activeLessonCodes"
  >,
): VisualStatus {
  if (projection.completedLessonCodes.includes(lessonCode)) return "complete";
  if (projection.activeLessonCodes.includes(lessonCode)) return "in-progress";
  return "available";
}

export function courseModuleVisualStatus(
  moduleCode: string,
  projection: Pick<
    CourseProgressProjection,
    | "completedLessonCodes"
    | "activeLessonCodes"
    | "completedModuleCodes"
    | "projectStatuses"
  >,
  projectCode: ProjectCode,
): VisualStatus {
  if (projection.completedModuleCodes.includes(moduleCode)) return "complete";

  const hasLessonProgress = projection.completedLessonCodes.some(
    (lessonCode) => lessonCode.startsWith(`${moduleCode}_`),
  ) || projection.activeLessonCodes.some(
    (lessonCode) => lessonCode.startsWith(`${moduleCode}_`),
  );
  const projectStatus = courseProjectStatusMap(projection).get(projectCode) ?? "none";
  return hasLessonProgress || projectStatus !== "none" ? "in-progress" : "available";
}
