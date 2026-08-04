import type { ContentStatus } from "./status.ts";

export type ModuleCode = `M${number}`;
export type LessonCode = `M${number}_L${number}`;
export type ProjectCode = `M${number}_P${number}`;
export type ProjectFormatType = "SINGLE_BOARD" | "MULTI_PAGE_PACK";
export type ContentFamily = "RUSSIAN_FIRST_CORE" | "ENGLISH_DOCUMENTARY";

export interface SourceProvenance {
  sourceId: string;
  relativePath: string;
  role: string;
  sha256: string;
  sizeBytes: number;
  immutable: true;
  contentVersion: string;
}

export interface OutcomeRecord {
  order: number;
  label: string;
  text: string;
  sourceText: string;
}

export interface AssetRecord {
  role: string;
  status: ContentStatus;
  canonicalFilename: string;
  source: SourceProvenance | null;
  publicationStatus: ContentStatus;
  sourceFilenamePublished?: false;
  validationSampleOnly?: boolean;
}

export interface TranscriptSection {
  id: `S${number}`;
  order: number;
  text: string;
}

export interface TranscriptRecord {
  canonicalFile: string;
  sections: TranscriptSection[];
  sectionCount: number;
  source: SourceProvenance;
}

export interface VocabularyEntry {
  number: number;
  termEn: string;
  termRu: string;
  definition: string;
  contextExample: string;
  sourcePage: number;
  visualDescription: string | null;
}

export interface MiniOutputStep {
  order: number;
  text: string;
}

export interface MiniOutputRecord {
  title: { en: string | null; ru: string | null };
  purpose: string;
  status: string;
  estimatedTime: string;
  tools: string[];
  studentTask: string;
  orderedSteps: MiniOutputStep[];
  ourExampleHeading: string;
  selfCheck: string[];
  source: SourceProvenance;
}

export type DeepDiveBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string };

export interface DeepDiveResource {
  label: string;
  href: string;
}

export type DeepDive = null | {
  title: string;
  summary?: string;
  orderedContentBlocks: DeepDiveBlock[];
  resources?: DeepDiveResource[];
  status: ContentStatus;
};

export interface QuizOption {
  id: string;
  text: string;
}

export interface PublicQuizQuestion {
  id: string;
  questionText: string;
  options: QuizOption[];
}

export interface PublicQuiz {
  lessonCode: LessonCode;
  quizVersion: string;
  questions: PublicQuizQuestion[];
}

export interface ServerQuizAnswer {
  questionId: string;
  correctOptionId: string;
  explanation: string;
}

export interface ServerQuizAnswerSet {
  lessonCode: LessonCode;
  quizVersion: string;
  answers: ServerQuizAnswer[];
}

export interface ModuleRecord {
  code: ModuleCode;
  titleRu: string;
  titleEn: string;
  order: number;
  lessonCodes: LessonCode[];
  projectCode: ProjectCode;
  goal: string;
  outcomes: OutcomeRecord[];
  status: ContentStatus;
  sourceProvenance: SourceProvenance[];
  contentVersion: string;
}

export interface LessonRecord {
  code: LessonCode;
  titleRu: string;
  titleEn: string;
  moduleCode: ModuleCode;
  orderInModule: number;
  globalOrder: number;
  objective: string;
  learningOutcomes: OutcomeRecord[];
  assets: Record<"PRES" | "SRPT" | "VOCB" | "MNOT" | "PICE", AssetRecord>;
  transcript: TranscriptRecord | null;
  vocabularyEntries: VocabularyEntry[];
  vocabularyExtractionWarnings: string[];
  miniOutput: MiniOutputRecord | null;
  deepDive: DeepDive;
  quiz: { lessonCode: LessonCode; quizVersion: string; questionCount: number };
  youtubeId: string | null;
  captionsFile: string | null;
  resources: Array<{ label: string; href: string }>;
  mediaStatus: { video: ContentStatus; captions: ContentStatus };
  status: ContentStatus;
  sourceProvenance: SourceProvenance[];
  contentVersion: string;
}

export interface ProjectContentParagraph {
  order: number;
  type: "paragraph";
  style: string | null;
  text: string;
}

export interface ProjectContentTable {
  order: number;
  type: "table";
  rows: string[][];
}

export interface NormalizedProjectContent {
  blocks: Array<ProjectContentParagraph | ProjectContentTable>;
  blockCount: number;
  source: SourceProvenance;
}

export interface ProjectRecord {
  code: ProjectCode;
  titleRu: string;
  titleEn: string;
  moduleCode: ModuleCode;
  order: number;
  objective: string;
  assessedOutcomes: OutcomeRecord[];
  assets: {
    studentPageFile: AssetRecord;
    examplePptxFile: AssetRecord;
    examplePreviewImage: AssetRecord;
  };
  formatType: ProjectFormatType;
  status: ContentStatus;
  validationSampleOnly: boolean;
  normalizedPublicContent: NormalizedProjectContent | null;
  sourceProvenance: SourceProvenance[];
  contentVersion: string;
}

export interface CourseRecord {
  code: "ARCHSTART";
  name: "ARCH.START";
  languageMode: "RUSSIAN_FIRST_CORE";
  moduleCount: number;
  lessonCount: number;
  projectCount: number;
  quizQuestionCount: number;
}

export interface PendingAssetRecord {
  contentCode: string;
  contentType: "LESSON" | "PROJECT";
  role: string;
  status: ContentStatus;
  reason: string;
}

export interface AliasRecord {
  sourceFilename: string;
  canonicalCode: ProjectCode;
  canonicalRole: "STUDENT_PAGE" | "EXAMPLE_PPTX";
  canonicalPublicFilename: string;
  reason: string;
  sourcePresent: boolean;
  sourceRelativePath: string | null;
  sourceSha256: string | null;
  status: ContentStatus;
  deterministicExactMatch: true;
  fuzzyMatchingUsed: false;
}

export interface SanitationWarning {
  code: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
}

export interface SanitationRecord {
  source: SourceProvenance;
  inspectionMode: "NON_DESTRUCTIVE";
  publicationStatus: ContentStatus;
  details: Record<string, unknown>;
  warnings: SanitationWarning[];
}

export interface RouteLanguageFamily {
  language: "ru" | "en";
  documentLanguage: "ru" | "en";
  routePrefix: "/" | "/en";
  status: string;
  patterns: string[];
  authenticationRequired?: boolean;
  inventedBodyCopyAllowed?: boolean;
}

export interface RouteLanguageMap {
  schemaVersion: string;
  architecture: "sectional-language-not-full-localization";
  core: RouteLanguageFamily;
  documentary: RouteLanguageFamily;
  prohibitions: {
    globalLanguageSwitch: true;
    duplicateEnglishLessonTree: true;
    machineTranslatedPublishedCopy: true;
    mixedLanguageUncontrolledBodyField: true;
  };
}

export type ManifestAssetClassification =
  | "AUTHORITATIVE_GEN"
  | "LESSON_ALLOWLIST"
  | "PROJECT_ALLOWLIST"
  | "EXPLICIT_ALIAS";

export interface ManifestAssetRecord {
  relativePath: string;
  fileName: string;
  classification: ManifestAssetClassification;
  role: string | null;
  contentCode: ModuleCode | LessonCode | ProjectCode | null;
  status: ContentStatus;
  canonicalPublicFilename: string | null;
  reason: string | null;
  sourceSha256: string;
  sizeBytes: number;
  sourcePathPublic: null;
}

export interface ContentManifest {
  schemaVersion: string;
  contentVersion: string;
  generatedAt: string;
  sourcePolicy: "CLEAN_ALLOWLIST_DEFAULT_DENY";
  counts: { modules: number; lessons: number; projects: number; quizQuestions: number };
  statuses: ContentStatus[];
  authoritativeSources: SourceProvenance[];
  entities: {
    modules: Array<{ code: ModuleCode; contentVersion: string }>;
    lessons: Array<{ code: LessonCode; contentVersion: string }>;
    projects: Array<{ code: ProjectCode; contentVersion: string; formatType: ProjectFormatType }>;
    quizzes: Array<{ lessonCode: LessonCode; quizVersion: string; questionCount: number }>;
  };
  assetRegistry: ManifestAssetRecord[];
  aliasCount: number;
  ignoredCount: number;
  duplicateCount: number;
  publicGeneratedBoundaries: ["generated/public"];
  serverOnlyGeneratedBoundaries: ["generated/server"];
}

export interface CourseIndex {
  schemaVersion: string;
  contentVersion: string;
  generatedAt: string;
  course: CourseRecord;
  modules: Array<Omit<ModuleRecord, "sourceProvenance">>;
  lessons: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
}
