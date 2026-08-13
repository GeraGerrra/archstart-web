import { courseLessonItemRoute, courseProjectRoute } from "@/src/routing/production-routes";

export interface LessonNextAction {
  href: string;
  label: string;
  context: "lesson" | "project";
}

interface LessonNavigationInput {
  moduleCode: string;
  lessonCode: string;
  orderedLessonCodes: readonly string[];
}

function lessonSlug(lessonCode: string): string {
  return `l${lessonCode.slice(-2).toLowerCase()}`;
}

/**
 * Resolves the source-only prototype action after the final item of a lesson.
 * It uses the canonical ordered lesson sequence and never routes the final
 * lesson back to itself.
 */
export function resolveLessonNextAction({
  moduleCode,
  lessonCode,
  orderedLessonCodes,
}: LessonNavigationInput): LessonNextAction {
  const normalizedModule = moduleCode.toUpperCase();
  const normalizedLesson = lessonCode.toUpperCase();
  const normalizedSequence = orderedLessonCodes.map((code) => code.toUpperCase());
  const currentIndex = normalizedSequence.indexOf(normalizedLesson);
  const nextLessonCode = currentIndex >= 0 ? normalizedSequence[currentIndex + 1] : undefined;

  if (nextLessonCode) {
    return {
      href: courseLessonItemRoute(normalizedModule, lessonSlug(nextLessonCode), "overview"),
      label: `Перейти к ${nextLessonCode.replace("_", " · ")}`,
      context: "lesson",
    };
  }

  return {
    href: courseProjectRoute(normalizedModule),
    label: `Перейти к Project ${normalizedModule.slice(1)}`,
    context: "project",
  };
}
