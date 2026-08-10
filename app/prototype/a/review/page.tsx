import { redirect } from "next/navigation";
import { requireOnboardedProfile } from "@/src/auth/guards";
import { StaffProjectWorkspace } from "@/src/learning/review/StaffProjectWorkspace";
import { SelectedAShell } from "@/src/prototypes/selected-a/shell-adapter";
import { loadStaffProjectWorkspaceProjection } from "@/src/server/project-workspace-projection";
import { loadCourseProgressProjection } from "@/src/server/course-progress-projection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StaffProjectReviewPage() {
  await requireOnboardedProfile("/prototype/a/review");
  const [projection, progressProjection] = await Promise.all([
    loadStaffProjectWorkspaceProjection(),
    loadCourseProgressProjection(),
  ]);
  if (projection.kind === "denied") redirect("/prototype/a/dashboard");

  return (
    <SelectedAShell
      active="account"
      currentModule={progressProjection.currentModuleCode}
      progressProjection={progressProjection}
    >
      <StaffProjectWorkspace projection={projection} />
    </SelectedAShell>
  );
}
