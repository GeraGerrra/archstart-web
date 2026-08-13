import { redirect } from "next/navigation";
import { getLesson, pathItem } from "@/src/prototypes/selected-a/data";

export default async function LegacyTranscriptPage({
  params,
}: {
  params: Promise<{ moduleCode: string; lessonCode: string }>;
}) {
  const { moduleCode, lessonCode } = await params;
  const code = `${moduleCode.toUpperCase()}_L${lessonCode.replace(/^l/i, "").padStart(2, "0")}`;
  const lesson = getLesson(code);
  if (!lesson) redirect(`/course/${moduleCode.toLowerCase()}`);
  redirect(pathItem(moduleCode, lesson.code, "lecture-materials"));
}
