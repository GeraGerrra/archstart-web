import { notFound } from "next/navigation";
import { SelectedAProject } from "@/src/prototypes/selected-a/SelectedAPrototype";
import { courseModules, getModule } from "@/src/prototypes/selected-a/data";

export function generateStaticParams() {
  return courseModules.map((courseModule) => ({ moduleCode: courseModule.code.toLowerCase() }));
}

export default async function SelectedAProjectPage({ params }: { params: Promise<{ moduleCode: string }> }) {
  const { moduleCode } = await params;
  const courseModule = getModule(moduleCode);
  if (!courseModule) notFound();
  return <SelectedAProject moduleCode={courseModule.code} />;
}
