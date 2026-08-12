import { SelectedAHome } from "@/src/prototypes/selected-a/SelectedAPrototype";
import { loadCourseProgressProjection } from "@/src/server/course-progress-projection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const [query, progressProjection] = await Promise.all([
    searchParams,
    loadCourseProgressProjection(),
  ]);
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  return (
    <SelectedAHome
      forceModuleMenu={state === "module-menu-open" ? "M01" : null}
      forceMobileModules={state === "mobile-modules-open"}
      progressProjection={progressProjection}
    />
  );
}
