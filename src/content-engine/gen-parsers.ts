import type { LessonCode, ModuleCode, OutcomeRecord, ProjectCode } from "./types.ts";

export interface StructureModule {
  code: ModuleCode;
  titleRu: string;
  titleEn: string;
  order: number;
  lessonCodes: LessonCode[];
  projectCode: ProjectCode;
}

export interface StructureLesson {
  code: LessonCode;
  titleRu: string;
  titleEn: string;
  moduleCode: ModuleCode;
  orderInModule: number;
  globalOrder: number;
}

export interface StructureProject {
  code: ProjectCode;
  titleRu: string;
  titleEn: string;
  moduleCode: ModuleCode;
  order: number;
}

export interface ParsedCourseStructure {
  modules: StructureModule[];
  lessons: StructureLesson[];
  projects: StructureProject[];
}

export interface ObjectiveRecord {
  code: string;
  titleRu: string;
  titleEn: string;
  objective: string;
  outcomes: OutcomeRecord[];
}

export interface RawQuizQuestion {
  number: number;
  questionText: string;
  options: Array<{ letter: "A" | "B" | "C" | "D"; text: string }>;
  correctLetter: "A" | "B" | "C" | "D";
  explanation: string;
}

const COURSE_BLOCK = /^(M\d{2}(?:_[LP]\d{2})?)\s*\nRU:\s*(.*?)\s*\nEN:\s*(.*?)(?=\n\s*\nM\d{2}(?:_[LP]\d{2})?\s*\n|$)/gms;

export function parseCourseStructure(text: string): ParsedCourseStructure {
  const records = [...text.trim().matchAll(COURSE_BLOCK)].map((match) => ({
    code: (match[1] ?? "").trim(),
    titleRu: (match[2] ?? "").trim(),
    titleEn: (match[3] ?? "").trim(),
  }));
  if (records.length === 0) throw new Error("Course Structure.txt produced no official records.");

  const modules: StructureModule[] = [];
  const lessons: StructureLesson[] = [];
  const projects: StructureProject[] = [];
  let current: StructureModule | null = null;

  for (const record of records) {
    if (/^M\d{2}$/.test(record.code)) {
      current = {
        ...record,
        code: record.code as ModuleCode,
        order: modules.length + 1,
        lessonCodes: [],
        projectCode: "" as ProjectCode,
      };
      modules.push(current);
      continue;
    }
    if (!current || !record.code.startsWith(`${current.code}_`)) {
      throw new Error(`Official course order has a module mismatch at ${record.code}.`);
    }
    if (/^M\d{2}_L\d{2}$/.test(record.code)) {
      const lesson: StructureLesson = {
        ...record,
        code: record.code as LessonCode,
        moduleCode: current.code,
        orderInModule: current.lessonCodes.length + 1,
        globalOrder: lessons.length + 1,
      };
      current.lessonCodes.push(lesson.code);
      lessons.push(lesson);
      continue;
    }
    if (/^M\d{2}_P\d{2}$/.test(record.code)) {
      const project: StructureProject = {
        ...record,
        code: record.code as ProjectCode,
        moduleCode: current.code,
        order: projects.length + 1,
      };
      if (current.projectCode) throw new Error(`Module ${current.code} contains more than one official project.`);
      current.projectCode = project.code;
      projects.push(project);
      continue;
    }
    throw new Error(`Unrecognized official code in Course Structure.txt: ${record.code}`);
  }

  for (const moduleRecord of modules) {
    if (moduleRecord.lessonCodes.length !== 5) throw new Error(`${moduleRecord.code} must contain exactly five official lessons.`);
    if (!moduleRecord.projectCode) throw new Error(`${moduleRecord.code} has no official module project.`);
  }
  return { modules, lessons, projects };
}

function splitCodeBlocks(text: string, codePattern: RegExp): Array<{ code: string; block: string }> {
  const flags = codePattern.flags.includes("g") ? codePattern.flags : `${codePattern.flags}g`;
  const matcher = new RegExp(codePattern.source, flags);
  const matches = [...text.matchAll(matcher)];
  return matches.map((match, index) => ({
    code: match[1] ?? "",
    block: text.slice(match.index! + match[0].length, matches[index + 1]?.index ?? text.length).trim(),
  }));
}

export function parseObjectiveFile(text: string, kind: "module" | "lesson" | "project"): Map<string, ObjectiveRecord> {
  const configuration = kind === "module"
    ? { code: /^(M\d{2})\s*$/gm, objective: "Module goal", outcomes: "Module outcomes" }
    : kind === "lesson"
      ? { code: /^(M\d{2}_L\d{2})\s*$/gm, objective: "Lesson objective", outcomes: "Learning outcomes" }
      : { code: /^(M\d{2}_P\d{2})\s*$/gm, objective: "Project objective", outcomes: "Assessed outcomes" };
  const result = new Map<string, ObjectiveRecord>();

  for (const { code, block } of splitCodeBlocks(text, configuration.code)) {
    const title = /^\s*RU:\s*(.*?)\s*\nEN:\s*(.*?)\s*\n/ms.exec(block);
    if (!title) throw new Error(`${kind} objective block ${code} has no RU/EN title pair.`);
    const remaining = block.slice(title.index + title[0].length).trim();
    const boundary = new RegExp(`^${escapeRegExp(configuration.objective)}\\s*\\n([\\s\\S]*?)\\n\\s*${escapeRegExp(configuration.outcomes)}\\s*\\n([\\s\\S]*)$`, "m").exec(remaining);
    if (!boundary) throw new Error(`Cannot parse objective/outcome boundary for ${code}.`);
    const outcomeLines = (boundary[2] ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
    const outcomes = outcomeLines.map((sourceText, index): OutcomeRecord => {
      const parts = sourceText.split("—", 2);
      return {
        order: index + 1,
        label: parts.length > 1 ? parts[0]!.trim() : "",
        text: parts.length > 1 ? sourceText.slice(sourceText.indexOf("—") + 1).trim() : sourceText,
        sourceText,
      };
    });
    result.set(code, {
      code,
      titleRu: (title[1] ?? "").trim(),
      titleEn: (title[2] ?? "").trim(),
      objective: (boundary[1] ?? "").trim(),
      outcomes,
    });
  }
  if (result.size === 0) throw new Error(`${kind} objectives produced no records.`);
  return result;
}

export function parseQuizzes(text: string): Map<LessonCode, RawQuizQuestion[]> {
  const lessonMatches = [...text.matchAll(/^(M\d{2}_L\d{2})\s*$/gm)];
  const result = new Map<LessonCode, RawQuizQuestion[]>();
  for (let lessonIndex = 0; lessonIndex < lessonMatches.length; lessonIndex += 1) {
    const lessonMatch = lessonMatches[lessonIndex]!;
    const lessonCode = lessonMatch[1] as LessonCode;
    const block = text.slice(lessonMatch.index! + lessonMatch[0].length, lessonMatches[lessonIndex + 1]?.index ?? text.length);
    const questionMatches = [...block.matchAll(/^#Вопрос\s+(\d+)\s*$/gm)];
    const questions: RawQuizQuestion[] = [];
    for (let questionIndex = 0; questionIndex < questionMatches.length; questionIndex += 1) {
      const questionMatch = questionMatches[questionIndex]!;
      const questionBlock = block.slice(questionMatch.index! + questionMatch[0].length, questionMatches[questionIndex + 1]?.index ?? block.length).trim();
      const answer = /^Правильный ответ:\s*([A-D])\.?\s*$/m.exec(questionBlock);
      const explanation = /^Пояснение:\s*$/m.exec(questionBlock);
      if (!answer || !explanation) throw new Error(`Cannot parse answer/explanation for ${lessonCode} question ${questionMatch[1]}.`);
      const body = questionBlock.slice(0, answer.index).trim();
      const optionMatches = [...body.matchAll(/^([A-D])\.\s+/gm)];
      if (optionMatches.length !== 4) throw new Error(`${lessonCode} question ${questionMatch[1]} must have four A-D options.`);
      const questionText = body.slice(0, optionMatches[0]!.index).trim();
      const options = optionMatches.map((option, index) => ({
        letter: option[1] as "A" | "B" | "C" | "D",
        text: body.slice(option.index! + option[0].length, optionMatches[index + 1]?.index ?? body.length).trim(),
      }));
      questions.push({
        number: Number.parseInt(questionMatch[1]!, 10),
        questionText,
        options,
        correctLetter: answer[1] as "A" | "B" | "C" | "D",
        explanation: questionBlock.slice(explanation.index + explanation[0].length).trim(),
      });
    }
    result.set(lessonCode, questions);
  }
  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
