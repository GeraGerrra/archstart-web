import { notFound } from "next/navigation";
import {
  completeLessonCompletionAction,
  undoLessonCompletionAction,
} from "@/src/server/completion-actions";
import { loadLessonCompletionSnapshot } from "@/src/server/completion-state";
import { submitQuizAttemptAction } from "@/src/server/quiz-attempt-action";
import { SelectedALesson } from "@/src/prototypes/selected-a/SelectedAPrototype";
import { getLesson, importedLessons, itemIs, itemsFor, slugLesson } from "@/src/prototypes/selected-a/data";
import { LessonActivityRecorder } from "./LessonActivityRecorder";

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
  const completionSnapshot = item === "quiz"
    ? await loadLessonCompletionSnapshot(lesson.code)
    : { state: "locked" as const };
  const completionState = process.env.NODE_ENV === "development"
    ? state === "lesson-complete"
      ? "complete"
      : state === "lesson-ready"
        ? "ready"
        : completionSnapshot.state
    : completionSnapshot.state;

  return (
    <>
      <LessonActivityRecorder lessonCode={lesson.code} item={item} />
      <SelectedALesson
        lessonCode={lesson.code}
        item={item}
        completionState={completionState}
        forceContents={state === "contents-open"}
        forceModuleMenu={state === "module-menu-open" ? normalizedModule : null}
        quizSubmitAction={submitQuizAttemptAction}
        completeCompletionAction={completeLessonCompletionAction.bind(null, lesson.code)}
        undoCompletionAction={undoLessonCompletionAction.bind(null, lesson.code)}
      />
    </>
  );
}
