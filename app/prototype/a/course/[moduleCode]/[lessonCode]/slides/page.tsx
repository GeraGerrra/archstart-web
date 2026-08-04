import { redirect } from "next/navigation";
import { getLesson, slugLesson } from "@/src/prototypes/selected-a/data";

/**
 * V3 legacy redirect: /slides → /lecture-materials
 * slides is merged into lecture-materials in V3.
 */
export default async function LegacySlidesPage({ params }: { params: Promise<{ moduleCode: string; lessonCode: string }> }) {
  const { moduleCode, lessonCode } = await params;
  const code = `${moduleCode.toUpperCase()}_L${lessonCode.replace(/^l/i, "").padStart(2, "0")}`;
  const lesson = getLesson(code);
  if (!lesson) redirect(`/prototype/a/course/${moduleCode.toLowerCase()}`);
  redirect(`/prototype/a/course/${moduleCode.toLowerCase()}/${slugLesson(lesson.code)}/lecture-materials`);
}
