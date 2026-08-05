import { notFound } from "next/navigation";
import { submitQuizAttemptAction } from "@/src/server/quiz-attempt-action";
import { SelectedALesson } from "@/src/prototypes/selected-a/SelectedAPrototype";
import { getLesson, importedLessons, itemIs, itemsFor, slugLesson } from "@/src/prototypes/selected-a/data";

export function generateStaticParams() {
  return importedLessons.flatMap((lesson) =>
    itemsFor(lesson).map((item) => ({ moduleCode: lesson.moduleCode.toLowerCase(), lessonCode: slugLesson(lesson.code), item: item.id })),
  );
}

export default async function SelectedALessonItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleCode: string; lessonCode: string; item: string }>;
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const [{ moduleCode, lessonCode, item }, query] = await Promise.all([params, searchParams]);
  const normalizedModule = moduleCode.toUpperCase();
  if (!["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08"].includes(normalizedModule)) notFound();
  const code = `${normalizedModule}_L${lessonCode.replace(/^l/i, "").padStart(2, "0")}`;
  const lesson = getLesson(code);
  if (!lesson || !itemIs(item) || !itemsFor(lesson).some((entry) => entry.id === item)) notFound();
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  return (
    <SelectedALesson
      lessonCode={lesson.code}
      item={item}
      completionState={state === "lesson-complete" ? "complete" : state === "lesson-ready" ? "ready" : "locked"}
      forceContents={state === "contents-open"}
      forceModuleMenu={state === "module-menu-open" ? normalizedModule : null}
      quizSubmitAction={submitQuizAttemptAction}
    />
  );
}
