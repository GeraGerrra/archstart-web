import { notFound } from "next/navigation";
import { ModuleScreen } from "@/src/prototypes/components/ModuleScreen";
import { DIRECTION_IDS, isDirectionId } from "@/src/prototypes/directions";

export function generateStaticParams() {
  return DIRECTION_IDS.map((direction) => ({ direction, moduleCode: "m01" }));
}

export default async function PrototypeModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ direction: string; moduleCode: string }>;
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const [{ direction, moduleCode }, query] = await Promise.all([params, searchParams]);
  if (!isDirectionId(direction) || moduleCode.toLowerCase() !== "m01") {
    notFound();
  }
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  return <ModuleScreen direction={direction} initialCompleted={state === "module-complete"} />;
}
