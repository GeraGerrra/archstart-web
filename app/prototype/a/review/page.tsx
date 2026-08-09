import { redirect } from "next/navigation";
import { requireOnboardedProfile } from "@/src/auth/guards";
import { StaffProjectWorkspace } from "@/src/learning/review/StaffProjectWorkspace";
import { SelectedAShell } from "@/src/prototypes/selected-a/shell-adapter";
import { loadStaffProjectWorkspaceProjection } from "@/src/server/project-workspace-projection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StaffProjectReviewPage() {
  await requireOnboardedProfile("/prototype/a/review");
  const projection = await loadStaffProjectWorkspaceProjection();
  if (projection.kind === "denied") redirect("/prototype/a/dashboard");

  return (
    <SelectedAShell active="account" currentModule="M01">
      <StaffProjectWorkspace projection={projection} />
    </SelectedAShell>
  );
}
