import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/src/learning/project/ProjectWorkspace";
import { SelectedAProject } from "@/src/prototypes/selected-a/SelectedAPrototype";
import { courseModules, getModule, pathProject } from "@/src/prototypes/selected-a/data";
import { loadLearnerProjectWorkspaceProjection } from "@/src/server/project-workspace-projection";
import { loadCourseProgressProjection } from "@/src/server/course-progress-projection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  return courseModules.map((courseModule) => ({ moduleCode: courseModule.code.toLowerCase() }));
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ moduleCode: string }>;
}) {
  const { moduleCode } = await params;
  const courseModule = getModule(moduleCode);
  if (!courseModule) notFound();
  const returnPath = pathProject(courseModule.code);
  const [projection, progressProjection] = await Promise.all([
    loadLearnerProjectWorkspaceProjection(courseModule.code, returnPath),
    loadCourseProgressProjection(),
  ]);
  return (
    <SelectedAProject
      moduleCode={courseModule.code}
      progressProjection={progressProjection}
      workspaceContent={<ProjectWorkspace projection={projection} />}
    />
  );
}
