import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/src/learning/project/ProjectWorkspace";
import { SelectedAProject } from "@/src/prototypes/selected-a/SelectedAPrototype";
import { courseModules, getModule } from "@/src/prototypes/selected-a/data";
import { loadLearnerProjectWorkspaceProjection } from "@/src/server/project-workspace-projection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  return courseModules.map((courseModule) => ({ moduleCode: courseModule.code.toLowerCase() }));
}

export default async function SelectedAProjectPage({ params }: { params: Promise<{ moduleCode: string }> }) {
  const { moduleCode } = await params;
  const courseModule = getModule(moduleCode);
  if (!courseModule) notFound();
  const returnPath = `/prototype/a/course/${courseModule.code.toLowerCase()}/project`;
  const projection = await loadLearnerProjectWorkspaceProjection(
    courseModule.code,
    returnPath,
  );
  return (
    <SelectedAProject
      moduleCode={courseModule.code}
      workspaceContent={<ProjectWorkspace projection={projection} />}
    />
  );
}
