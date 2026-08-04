import { notFound } from "next/navigation";
import { HomeScreen } from "@/src/prototypes/components/HomeScreen";
import { DIRECTION_IDS, isDirectionId } from "@/src/prototypes/directions";

export function generateStaticParams() {
  return DIRECTION_IDS.map((direction) => ({ direction }));
}

export default async function PrototypeHomePage({
  params,
}: {
  params: Promise<{ direction: string }>;
}) {
  const { direction } = await params;
  if (!isDirectionId(direction)) {
    notFound();
  }
  return <HomeScreen direction={direction} />;
}
