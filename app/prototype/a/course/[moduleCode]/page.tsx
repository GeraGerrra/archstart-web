import { notFound } from "next/navigation";
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
  return (
    <SelectedAModule
      moduleCode={courseModule.code}
      expandedLesson={lesson?.toUpperCase() ?? (["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08"].includes(courseModule.code) ? `${courseModule.code}_L01` : null)}
      forceModuleMenu={state === "module-menu-open" ? courseModule.code : null}
      completionState={state === "module-complete" ? "complete" : state === "module-ready" ? "ready" : "locked"}
    />
  );
}
