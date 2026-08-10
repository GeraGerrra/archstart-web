import { requireOnboardedProfile } from "@/src/auth/guards";
import { PrivateCertificatePage } from "@/src/certificate";
import { SelectedAShell } from "@/src/prototypes/selected-a/shell-adapter";
import { loadMyCertificateProjection } from "@/src/server/certificate-projection";
import { loadCourseProgressProjection } from "@/src/server/course-progress-projection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MyCertificatePage() {
  await requireOnboardedProfile("/prototype/a/certificate");
  const [certificateProjection, progressProjection] = await Promise.all([
    loadMyCertificateProjection(),
    loadCourseProgressProjection(),
  ]);

  return (
    <SelectedAShell
      active="dashboard"
      currentModule={progressProjection.currentModuleCode}
      progressProjection={progressProjection}
    >
      <PrivateCertificatePage projection={certificateProjection} />
    </SelectedAShell>
  );
}
