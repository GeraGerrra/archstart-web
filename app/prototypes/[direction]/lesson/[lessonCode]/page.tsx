import { notFound } from "next/navigation";
import { LessonScreen } from "@/src/prototypes/components/LessonScreen";
import { DIRECTION_IDS, isDirectionId } from "@/src/prototypes/directions";

export function generateStaticParams() {
  return DIRECTION_IDS.map((direction) => ({ direction, lessonCode: "m01-l01" }));
}

export default async function PrototypeLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ direction: string; lessonCode: string }>;
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const [{ direction, lessonCode }, query] = await Promise.all([params, searchParams]);
  if (!isDirectionId(direction) || lessonCode.toLowerCase() !== "m01-l01") {
    notFound();
  }
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  return <LessonScreen direction={direction} initialCompleted={state === "lesson-complete"} />;
}
