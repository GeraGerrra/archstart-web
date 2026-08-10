import { requireOnboardedProfile } from "@/src/auth/guards";
import { SelectedADashboard } from "@/src/prototypes/selected-a/SelectedAPrototype";
import { loadDashboardProjection } from "@/src/server/dashboard-projection";
import { loadMyCertificateProjection } from "@/src/server/certificate-projection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SignedInDashboardPage() {
  const { profile } = await requireOnboardedProfile("/prototype/a/dashboard");
  const [projection, certificateProjection] = await Promise.all([
    loadDashboardProjection(profile.first_name),
    loadMyCertificateProjection(),
  ]);

  return (
    <SelectedADashboard
      model={projection.model}
      progressProjection={projection.shellProgress}
      certificateProjection={certificateProjection}
    />
  );
}
