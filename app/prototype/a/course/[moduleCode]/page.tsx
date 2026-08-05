import { notFound } from "next/navigation";
import {
  completeModuleCompletionAction,
  undoModuleCompletionAction,
} from "@/src/server/completion-actions";
import { loadModuleCompletionSnapshot } from "@/src/server/completion-state";
import { SelectedAModule } from "@/src/prototypes/selected-a/SelectedAPrototype";
import { courseModules, getModule } from "@/src/prototypes/selected-a/data";

export function generateStaticParams() {
  return courseModules.map((courseModule) => ({ moduleCode: courseModule.code.toLowerCase() }));
}

export default async function SelectedAModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleCode: string }>;
  searchParams: Promise<{ state?: string | string[]; lesson?: string | string[] }>;
}) {
  const [{ moduleCode }, query] = await Promise.all([params, searchParams]);
  const courseModule = getModule(moduleCode);
  if (!courseModule) notFound();
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  const lesson = Array.isArray(query.lesson) ? query.lesson[0] : query.lesson;
  const completionSnapshot = await loadModuleCompletionSnapshot(courseModule.code);
  const completionState = process.env.NODE_ENV === "development"
    ? state === "module-complete"
      ? "complete"
      : state === "module-ready"
        ? "ready"
        : completionSnapshot.state
    : completionSnapshot.state;

  return (
    <SelectedAModule
      moduleCode={courseModule.code}
      expandedLesson={lesson?.toUpperCase() ?? `${courseModule.code}_L01`}
      forceModuleMenu={state === "module-menu-open" ? courseModule.code : null}
      completionState={completionState}
      completedLessonCodes={completionSnapshot.completedLessonCodes}
      completeCompletionAction={completeModuleCompletionAction.bind(null, courseModule.code)}
      undoCompletionAction={undoModuleCompletionAction.bind(null, courseModule.code)}
    />
  );
}
