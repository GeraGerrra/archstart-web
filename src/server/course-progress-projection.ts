import "server-only";

import {
  ANONYMOUS_COURSE_PROGRESS_PROJECTION,
  buildCourseProgressProjection,
  type CourseProgressProjection,
  type CourseProjectSubmissionInput,
} from "@/src/progress/course-progress";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import {
  isProjectSubmissionStatus,
  projectCodeForModule,
} from "@/src/project-workspace/policy";
import type { ProjectCode } from "@/src/project-workspace/types";

const LESSON_CODE_PATTERN = /^M0[1-8]_L0[1-5]$/u;
const MODULE_CODE_PATTERN = /^M0[1-8]$/u;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function rows(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(record).filter((row): row is Record<string, unknown> => Boolean(row))
    : [];
}

function validLessonCodes(value: unknown): readonly string[] {
  return [...new Set(
    rows(value)
      .map((row) => row.lesson_code)
      .filter((code): code is string =>
        typeof code === "string" && LESSON_CODE_PATTERN.test(code)),
  )].sort();
}

function validModuleCodes(value: unknown): readonly string[] {
  return [...new Set(
    rows(value)
      .map((row) => row.module_code)
      .filter((code): code is string =>
        typeof code === "string" && MODULE_CODE_PATTERN.test(code)),
  )].sort();
}

function projectSubmissionRows(value: unknown): readonly CourseProjectSubmissionInput[] {
  return rows(value).flatMap((row) => {
    const projectCode = row.project_code;
    const status = row.current_status;
    return typeof projectCode === "string"
      && projectCodeForModule(projectCode.slice(0, 3)) === projectCode
      && isProjectSubmissionStatus(status)
      ? [{ project_code: projectCode as ProjectCode, current_status: status }]
      : [];
  });
}

export async function loadCourseProgressProjection(): Promise<CourseProgressProjection> {
  const client = await createServerSupabaseClient();
  const { data: claimsResult, error: claimsError } = await client.auth.getClaims();
  const userId = typeof claimsResult?.claims?.sub === "string"
    ? claimsResult.claims.sub
    : "";

  if (claimsError || !userId) return ANONYMOUS_COURSE_PROGRESS_PROJECTION;

  const [activityResult, lessonResult, moduleResult, projectResult] = await Promise.all([
    client
      .from("lesson_activity")
      .select("lesson_code,last_visited_at")
      .eq("user_id", userId)
      .order("last_visited_at", { ascending: false }),
    client
      .from("lesson_completions")
      .select("lesson_code")
      .eq("user_id", userId),
    client
      .from("module_completions")
      .select("module_code")
      .eq("user_id", userId),
    client
      .from("project_submissions")
      .select("project_code,current_status"),
  ]);

  if (activityResult.error || lessonResult.error || moduleResult.error || projectResult.error) {
    throw new Error("Unable to load signed-in course progress projection.");
  }

  const completedLessonCodes = validLessonCodes(lessonResult.data);
  const completedLessonSet = new Set(completedLessonCodes);
  const activityLessonCodes = validLessonCodes(activityResult.data);
  const activeLessonCodes = activityLessonCodes.filter(
    (code) => !completedLessonSet.has(code),
  );

  return buildCourseProgressProjection({
    authenticated: true,
    completedLessonCodes,
    activeLessonCodes,
    moduleCompletionRowCodes: validModuleCodes(moduleResult.data),
    projectSubmissions: projectSubmissionRows(projectResult.data),
    latestActivityLessonCode: activityLessonCodes[0] ?? null,
  });
}
