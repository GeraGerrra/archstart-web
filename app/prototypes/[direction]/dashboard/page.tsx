import { notFound } from "next/navigation";
import { DashboardScreen } from "@/src/prototypes/components/DashboardScreen";
import { DIRECTION_IDS, isDirectionId } from "@/src/prototypes/directions";

export function generateStaticParams() {
  return DIRECTION_IDS.map((direction) => ({ direction }));
}

export default async function PrototypeDashboardPage({
  params,
}: {
  params: Promise<{ direction: string }>;
}) {
  const { direction } = await params;
  if (!isDirectionId(direction)) {
    notFound();
  }
  return <DashboardScreen direction={direction} />;
}
