import courseIndexJson from "@/generated/public/course-index.json";
import m01DatasetJson from "@/generated/public/m01-dataset.json";
import m01L01QuizJson from "@/generated/public/quizzes/M01_L01.json";

interface Outcome {
  order: number;
  label: string;
  text: string;
  sourceText: string;
}

interface TranscriptSection {
  id: string;
  order: number;
  text: string;
}

interface VocabularyEntry {
  number: number;
  termEn: string;
  termRu: string;
  definition: string;
  contextExample: string;
  sourcePage: number;
  visualDescription: string | null;
}

interface MiniOutputStep {
  order: number;
  text: string;
}

interface LessonRecord {
  code: string;
  titleRu: string;
  titleEn: string;
  moduleCode: string;
  orderInModule: number;
  objective: string;
  learningOutcomes: Outcome[];
  transcript: {
    canonicalFile: string;
    sections: TranscriptSection[];
    sectionCount: number;
  };
  vocabularyEntries: VocabularyEntry[];
  deepDive: unknown;
  miniOutput: {
    title: { en: string; ru: string };
    purpose: string;
    status: string;
    estimatedTime: string;
    tools: string[];
    studentTask: string;
    orderedSteps: MiniOutputStep[];
  };
  resources: unknown[];
  youtubeId: string | null;
  mediaStatus: {
    video: string;
    captions: string;
  };
}

interface ModuleRecord {
  code: string;
  titleRu: string;
  titleEn: string;
  goal: string;
  outcomes: Outcome[];
  lessonCodes: string[];
  projectCode: string;
}

interface ProjectRecord {
  code: string;
  titleRu: string;
  titleEn: string;
  objective: string;
  assessedOutcomes: Outcome[];
  formatType: string;
  normalizedPublicContent: {
    blocks: Array<{
      order: number;
      type: string;
      text?: string;
      rows?: string[][];
    }>;
    blockCount: number;
  };
}

interface PublicQuiz {
  lessonCode: string;
  quizVersion: string;
  questions: Array<{
    id: string;
    questionText: string;
    options: Array<{ id: string; text: string }>;
  }>;
}

interface CourseIndex {
  course: {
    code: string;
    name: string;
    languageMode: string;
    moduleCount: number;
    lessonCount: number;
    projectCount: number;
    quizQuestionCount: number;
  };
  modules: Array<{
    code: string;
    titleRu: string;
    titleEn: string;
    order: number;
    lessonCodes: string[];
    projectCode: string;
    goal: string;
    outcomes: Outcome[];
    status: string;
  }>;
}

interface M01Dataset {
  module: ModuleRecord;
  lessons: LessonRecord[];
  project: ProjectRecord;
}

export const courseIndex = courseIndexJson as CourseIndex;
export const m01Dataset = m01DatasetJson as M01Dataset;
export const m01Module = m01Dataset.module;
export const m01Lessons = m01Dataset.lessons;
const foundM01Lesson = m01Dataset.lessons.find((lesson) => lesson.code === "M01_L01");

if (!foundM01Lesson) {
  throw new Error("Accepted public content is missing M01_L01.");
}

export const m01Lesson = foundM01Lesson;
export const m01Project = m01Dataset.project;
export const m01Quiz = m01L01QuizJson as PublicQuiz;

function findProjectIdentityValue(label: string): string | null {
  for (const block of m01Project.normalizedPublicContent.blocks) {
    if (!block.rows) {
      continue;
    }
    for (const row of block.rows) {
      if (row[0] === label && row[1]) {
        return row[1];
      }
    }
  }
  return null;
}

export const projectIdentity = {
  mainQuestion: findProjectIdentityValue("MAIN QUESTION"),
  purpose: findProjectIdentityValue("PURPOSE"),
  estimatedTime: findProjectIdentityValue("ESTIMATED TIME"),
  finalFormat: findProjectIdentityValue("FINAL FORMAT"),
};

export const primaryAudience =
  "Старшеклассники и студенты первых курсов, которые начинают изучать архитектуру.";

export const moduleCompletionMessage =
  "Вы прочитали пространство через пользователя, функцию, движение, масштаб и проектное решение.";
