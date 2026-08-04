/**
 * Explicit browser-safe content-engine surface.
 * Server quiz answers are intentionally absent. Server code imports the
 * dedicated loader from `src/server/quiz-answer-key-loader.ts` instead.
 */
export { ROUTE_LANGUAGES, validateEnglishDocument } from "./language.ts";
export { findForbiddenQuizKeys } from "./quiz-boundary.ts";
export type { EnglishDocumentRecord } from "./language.ts";
export type {
  ContentManifest,
  CourseIndex,
  CourseRecord,
  LessonRecord,
  ModuleRecord,
  ProjectRecord,
  PublicQuiz,
  PublicQuizQuestion,
  QuizOption,
  RouteLanguageMap,
} from "./types.ts";
