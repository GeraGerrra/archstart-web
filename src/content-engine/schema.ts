import { EXPECTED_COUNTS } from "./constants.ts";
import { CONTENT_STATUSES } from "./status.ts";
import type {
  AliasRecord,
  AssetRecord,
  ContentManifest,
  CourseRecord,
  DeepDive,
  LessonRecord,
  ManifestAssetRecord,
  MiniOutputRecord,
  ModuleRecord,
  PendingAssetRecord,
  ProjectRecord,
  PublicQuiz,
  RouteLanguageMap,
  SanitationRecord,
  ServerQuizAnswerSet,
  SourceProvenance,
  TranscriptRecord,
  TranscriptSection,
  VocabularyEntry,
} from "./types.ts";

export class SchemaValidationError extends Error {
  readonly issues: string[];
  constructor(label: string, issues: string[]) {
    super(`${label} failed runtime validation:\n- ${issues.join("\n- ")}`);
    this.name = "SchemaValidationError";
    this.issues = issues;
  }
}

type RecordValue = Record<string, unknown>;
const statusSet = new Set<string>(CONTENT_STATUSES);

export function assertSourceProvenance(value: unknown, path = "source"): asserts value is SourceProvenance {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  requiredString(record, "sourceId", path, issues);
  const relativePath = requiredString(record, "relativePath", path, issues);
  if (relativePath && (relativePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(relativePath) || relativePath.includes("OneDrive") || relativePath.includes(".."))) {
    issues.push(`${path}.relativePath must be a safe source-root-relative POSIX path.`);
  }
  requiredString(record, "role", path, issues);
  const sha = requiredString(record, "sha256", path, issues);
  if (sha && !/^[a-f0-9]{64}$/.test(sha)) issues.push(`${path}.sha256 must be lowercase SHA-256 hex.`);
  positiveInteger(record, "sizeBytes", path, issues, true);
  if (record.immutable !== true) issues.push(`${path}.immutable must be true.`);
  requiredString(record, "contentVersion", path, issues);
  throwIfIssues("SourceProvenance", issues);
}

export function assertAssetRecord(value: unknown, path = "asset"): asserts value is AssetRecord {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  requiredString(record, "role", path, issues);
  contentStatus(record.status, `${path}.status`, issues);
  requiredString(record, "canonicalFilename", path, issues);
  if (record.source !== null && record.source !== undefined) collect(() => assertSourceProvenance(record.source, `${path}.source`), issues);
  contentStatus(record.publicationStatus, `${path}.publicationStatus`, issues);
  if (record.sourceFilenamePublished !== undefined && record.sourceFilenamePublished !== false) issues.push(`${path}.sourceFilenamePublished may only be false.`);
  if (record.validationSampleOnly !== undefined && typeof record.validationSampleOnly !== "boolean") issues.push(`${path}.validationSampleOnly must be boolean.`);
  throwIfIssues("AssetRecord", issues);
}

export function assertManifestAssetRecord(value: unknown, path = "manifestAsset"): asserts value is ManifestAssetRecord {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  const relativePath = requiredString(record, "relativePath", path, issues);
  if (relativePath && !isSafeRelativePath(relativePath)) issues.push(`${path}.relativePath must be a safe source-root-relative POSIX path.`);
  requiredString(record, "fileName", path, issues);
  const classification = requiredString(record, "classification", path, issues);
  if (!new Set(["AUTHORITATIVE_GEN", "LESSON_ALLOWLIST", "PROJECT_ALLOWLIST", "EXPLICIT_ALIAS"]).has(classification)) issues.push(`${path}.classification is not public-manifest eligible.`);
  nullableString(record.role, `${path}.role`, issues);
  nullableString(record.contentCode, `${path}.contentCode`, issues);
  if (typeof record.contentCode === "string" && !/^M\d{2}(?:_L\d{2}|_P\d{2})?$/.test(record.contentCode)) issues.push(`${path}.contentCode must be Mxx, Mxx_Lxx, Mxx_Pxx, or null.`);
  contentStatus(record.status, `${path}.status`, issues);
  if (record.status === "IGNORED_BY_POLICY") issues.push(`${path}.status cannot expose ignored-by-policy evidence in the public manifest.`);
  nullableString(record.canonicalPublicFilename, `${path}.canonicalPublicFilename`, issues);
  nullableString(record.reason, `${path}.reason`, issues);
  const sha = requiredString(record, "sourceSha256", path, issues);
  if (sha && !/^[a-f0-9]{64}$/.test(sha)) issues.push(`${path}.sourceSha256 must be lowercase SHA-256 hex.`);
  positiveInteger(record, "sizeBytes", path, issues, true);
  if (record.sourcePathPublic !== null) issues.push(`${path}.sourcePathPublic must remain null.`);
  throwIfIssues("ManifestAssetRecord", issues);
}

export function assertTranscriptSection(value: unknown, path = "section"): asserts value is TranscriptSection {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  const id = requiredString(record, "id", path, issues);
  if (id && !/^S\d{2}$/.test(id)) issues.push(`${path}.id must match Sxx.`);
  positiveInteger(record, "order", path, issues);
  requiredString(record, "text", path, issues);
  throwIfIssues("TranscriptSection", issues);
}

export function assertTranscriptRecord(value: unknown, path = "transcript"): asserts value is TranscriptRecord {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  requiredString(record, "canonicalFile", path, issues);
  const sections = expectArray(record.sections, `${path}.sections`, issues);
  sections.forEach((section, index) => collect(() => assertTranscriptSection(section, `${path}.sections[${index}]`), issues));
  positiveInteger(record, "sectionCount", path, issues);
  if (typeof record.sectionCount === "number" && record.sectionCount !== sections.length) issues.push(`${path}.sectionCount does not match sections.length.`);
  collect(() => assertSourceProvenance(record.source, `${path}.source`), issues);
  throwIfIssues("TranscriptRecord", issues);
}

export function assertVocabularyEntry(value: unknown, path = "vocabularyEntry"): asserts value is VocabularyEntry {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  positiveInteger(record, "number", path, issues);
  requiredString(record, "termEn", path, issues);
  requiredString(record, "termRu", path, issues);
  requiredString(record, "definition", path, issues);
  requiredString(record, "contextExample", path, issues);
  positiveInteger(record, "sourcePage", path, issues);
  if (record.visualDescription !== null && record.visualDescription !== undefined && typeof record.visualDescription !== "string") issues.push(`${path}.visualDescription must be string or null.`);
  throwIfIssues("VocabularyEntry", issues);
}

export function assertMiniOutputRecord(value: unknown, path = "miniOutput"): asserts value is MiniOutputRecord {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  const title = expectRecord(record.title, `${path}.title`, issues);
  nullableString(title.en, `${path}.title.en`, issues);
  nullableString(title.ru, `${path}.title.ru`, issues);
  for (const key of ["purpose", "status", "estimatedTime", "studentTask", "ourExampleHeading"] as const) requiredString(record, key, path, issues);
  stringArray(record.tools, `${path}.tools`, issues, true);
  const steps = expectArray(record.orderedSteps, `${path}.orderedSteps`, issues);
  steps.forEach((step, index) => {
    const stepRecord = expectRecord(step, `${path}.orderedSteps[${index}]`, issues);
    positiveInteger(stepRecord, "order", `${path}.orderedSteps[${index}]`, issues);
    requiredString(stepRecord, "text", `${path}.orderedSteps[${index}]`, issues);
  });
  stringArray(record.selfCheck, `${path}.selfCheck`, issues, true);
  collect(() => assertSourceProvenance(record.source, `${path}.source`), issues);
  throwIfIssues("MiniOutputRecord", issues);
}

export function assertDeepDive(value: unknown, path = "deepDive"): asserts value is DeepDive {
  if (value === null) return;
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  requiredString(record, "title", path, issues);
  if (record.summary !== undefined) requiredString(record, "summary", path, issues);
  const blocks = expectArray(record.orderedContentBlocks, `${path}.orderedContentBlocks`, issues);
  blocks.forEach((block, index) => {
    const blockRecord = expectRecord(block, `${path}.orderedContentBlocks[${index}]`, issues);
    const type = requiredString(blockRecord, "type", `${path}.orderedContentBlocks[${index}]`, issues);
    if (!new Set(["paragraph", "heading", "list", "quote"]).has(type)) issues.push(`${path}.orderedContentBlocks[${index}].type is unsupported.`);
    if (type === "list") stringArray(blockRecord.items, `${path}.orderedContentBlocks[${index}].items`, issues, true);
    else requiredString(blockRecord, "text", `${path}.orderedContentBlocks[${index}]`, issues);
  });
  if (record.resources !== undefined) {
    const resources = expectArray(record.resources, `${path}.resources`, issues);
    resources.forEach((resource, index) => {
      const item = expectRecord(resource, `${path}.resources[${index}]`, issues);
      requiredString(item, "label", `${path}.resources[${index}]`, issues);
      requiredString(item, "href", `${path}.resources[${index}]`, issues);
    });
  }
  contentStatus(record.status, `${path}.status`, issues);
  throwIfIssues("DeepDive", issues);
}

export function assertModuleRecord(value: unknown, path = "module"): asserts value is ModuleRecord {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  const code = requiredString(record, "code", path, issues);
  if (code && !/^M\d{2}$/.test(code)) issues.push(`${path}.code must match Mxx.`);
  requiredString(record, "titleRu", path, issues);
  requiredString(record, "titleEn", path, issues);
  positiveInteger(record, "order", path, issues);
  const lessonCodes = stringArray(record.lessonCodes, `${path}.lessonCodes`, issues, true);
  if (lessonCodes.length !== EXPECTED_COUNTS.lessons / EXPECTED_COUNTS.modules || lessonCodes.some((item) => !/^M\d{2}_L\d{2}$/.test(item))) issues.push(`${path}.lessonCodes must contain five Mxx_Lxx codes.`);
  if (code && lessonCodes.some((item) => !item.startsWith(`${code}_`))) issues.push(`${path}.lessonCodes must all belong to ${code}.`);
  const projectCode = requiredString(record, "projectCode", path, issues);
  if (projectCode && !/^M\d{2}_P\d{2}$/.test(projectCode)) issues.push(`${path}.projectCode must match Mxx_Pxx.`);
  if (code && projectCode && !projectCode.startsWith(`${code}_`)) issues.push(`${path}.projectCode must belong to ${code}.`);
  requiredString(record, "goal", path, issues);
  validateOutcomes(record.outcomes, `${path}.outcomes`, issues, 5);
  contentStatus(record.status, `${path}.status`, issues);
  validateProvenanceArray(record.sourceProvenance, `${path}.sourceProvenance`, issues);
  requiredString(record, "contentVersion", path, issues);
  throwIfIssues("ModuleRecord", issues);
}

export function assertLessonRecord(value: unknown, path = "lesson"): asserts value is LessonRecord {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  const code = requiredString(record, "code", path, issues);
  if (code && !/^M\d{2}_L\d{2}$/.test(code)) issues.push(`${path}.code must match Mxx_Lxx.`);
  const moduleCode = requiredString(record, "moduleCode", path, issues);
  if (moduleCode && !/^M\d{2}$/.test(moduleCode)) issues.push(`${path}.moduleCode must match Mxx.`);
  if (code && moduleCode && !code.startsWith(`${moduleCode}_`)) issues.push(`${path}.code must belong to moduleCode.`);
  requiredString(record, "titleRu", path, issues);
  requiredString(record, "titleEn", path, issues);
  positiveInteger(record, "orderInModule", path, issues);
  if (typeof record.orderInModule === "number" && record.orderInModule > 5) issues.push(`${path}.orderInModule must be between 1 and 5.`);
  positiveInteger(record, "globalOrder", path, issues);
  if (typeof record.globalOrder === "number" && record.globalOrder > EXPECTED_COUNTS.lessons) issues.push(`${path}.globalOrder must be between 1 and ${EXPECTED_COUNTS.lessons}.`);
  requiredString(record, "objective", path, issues);
  validateOutcomes(record.learningOutcomes, `${path}.learningOutcomes`, issues, 6);
  const assets = expectRecord(record.assets, `${path}.assets`, issues);
  for (const role of ["PRES", "SRPT", "VOCB", "MNOT", "PICE"]) collect(() => assertAssetRecord(assets[role], `${path}.assets.${role}`), issues);
  if (record.transcript !== null) collect(() => assertTranscriptRecord(record.transcript, `${path}.transcript`), issues);
  const entries = expectArray(record.vocabularyEntries, `${path}.vocabularyEntries`, issues);
  entries.forEach((entry, index) => collect(() => assertVocabularyEntry(entry, `${path}.vocabularyEntries[${index}]`), issues));
  stringArray(record.vocabularyExtractionWarnings, `${path}.vocabularyExtractionWarnings`, issues, false);
  if (record.miniOutput !== null) collect(() => assertMiniOutputRecord(record.miniOutput, `${path}.miniOutput`), issues);
  collect(() => assertDeepDive(record.deepDive, `${path}.deepDive`), issues);
  const quiz = expectRecord(record.quiz, `${path}.quiz`, issues);
  const quizLessonCode = requiredString(quiz, "lessonCode", `${path}.quiz`, issues);
  if (code && quizLessonCode && quizLessonCode !== code) issues.push(`${path}.quiz.lessonCode must equal ${code}.`);
  requiredString(quiz, "quizVersion", `${path}.quiz`, issues);
  positiveInteger(quiz, "questionCount", `${path}.quiz`, issues);
  if (quiz.questionCount !== EXPECTED_COUNTS.questionsPerLesson) issues.push(`${path}.quiz.questionCount must be ${EXPECTED_COUNTS.questionsPerLesson}.`);
  nullableString(record.youtubeId, `${path}.youtubeId`, issues);
  nullableString(record.captionsFile, `${path}.captionsFile`, issues);
  const resources = expectArray(record.resources, `${path}.resources`, issues);
  resources.forEach((resource, index) => {
    const item = expectRecord(resource, `${path}.resources[${index}]`, issues);
    requiredString(item, "label", `${path}.resources[${index}]`, issues);
    requiredString(item, "href", `${path}.resources[${index}]`, issues);
  });
  const media = expectRecord(record.mediaStatus, `${path}.mediaStatus`, issues);
  contentStatus(media.video, `${path}.mediaStatus.video`, issues);
  contentStatus(media.captions, `${path}.mediaStatus.captions`, issues);
  contentStatus(record.status, `${path}.status`, issues);
  validateProvenanceArray(record.sourceProvenance, `${path}.sourceProvenance`, issues);
  requiredString(record, "contentVersion", path, issues);
  throwIfIssues("LessonRecord", issues);
}

export function assertProjectRecord(value: unknown, path = "project"): asserts value is ProjectRecord {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  const code = requiredString(record, "code", path, issues);
  if (code && !/^M\d{2}_P\d{2}$/.test(code)) issues.push(`${path}.code must match Mxx_Pxx.`);
  const moduleCode = requiredString(record, "moduleCode", path, issues);
  if (moduleCode && !/^M\d{2}$/.test(moduleCode)) issues.push(`${path}.moduleCode must match Mxx.`);
  if (code && moduleCode && !code.startsWith(`${moduleCode}_`)) issues.push(`${path}.code must belong to moduleCode.`);
  requiredString(record, "titleRu", path, issues);
  requiredString(record, "titleEn", path, issues);
  positiveInteger(record, "order", path, issues);
  if (typeof record.order === "number" && record.order > EXPECTED_COUNTS.projects) issues.push(`${path}.order must be between 1 and ${EXPECTED_COUNTS.projects}.`);
  requiredString(record, "objective", path, issues);
  validateOutcomes(record.assessedOutcomes, `${path}.assessedOutcomes`, issues, 6);
  const assets = expectRecord(record.assets, `${path}.assets`, issues);
  for (const field of ["studentPageFile", "examplePptxFile", "examplePreviewImage"]) collect(() => assertAssetRecord(assets[field], `${path}.assets.${field}`), issues);
  if (record.formatType !== "SINGLE_BOARD" && record.formatType !== "MULTI_PAGE_PACK") issues.push(`${path}.formatType must be SINGLE_BOARD or MULTI_PAGE_PACK.`);
  if (code === "M08_P08" && record.formatType !== "MULTI_PAGE_PACK") issues.push(`${path}.formatType must remain MULTI_PAGE_PACK for M08_P08.`);
  contentStatus(record.status, `${path}.status`, issues);
  if (typeof record.validationSampleOnly !== "boolean") issues.push(`${path}.validationSampleOnly must be boolean.`);
  if (record.normalizedPublicContent !== null) {
    const content = expectRecord(record.normalizedPublicContent, `${path}.normalizedPublicContent`, issues);
    const blocks = expectArray(content.blocks, `${path}.normalizedPublicContent.blocks`, issues);
    positiveInteger(content, "blockCount", `${path}.normalizedPublicContent`, issues);
    if (typeof content.blockCount === "number" && content.blockCount !== blocks.length) issues.push(`${path}.normalizedPublicContent.blockCount mismatch.`);
    blocks.forEach((block, index) => {
      const item = expectRecord(block, `${path}.normalizedPublicContent.blocks[${index}]`, issues);
      positiveInteger(item, "order", `${path}.normalizedPublicContent.blocks[${index}]`, issues);
      if (item.type === "paragraph") {
        nullableString(item.style, `${path}.normalizedPublicContent.blocks[${index}].style`, issues);
        requiredString(item, "text", `${path}.normalizedPublicContent.blocks[${index}]`, issues);
      } else if (item.type === "table") {
        const rows = expectArray(item.rows, `${path}.normalizedPublicContent.blocks[${index}].rows`, issues);
        rows.forEach((row, rowIndex) => stringArray(row, `${path}.normalizedPublicContent.blocks[${index}].rows[${rowIndex}]`, issues, false));
      } else {
        issues.push(`${path}.normalizedPublicContent.blocks[${index}].type must be paragraph or table.`);
      }
    });
    collect(() => assertSourceProvenance(content.source, `${path}.normalizedPublicContent.source`), issues);
  }
  validateProvenanceArray(record.sourceProvenance, `${path}.sourceProvenance`, issues);
  requiredString(record, "contentVersion", path, issues);
  throwIfIssues("ProjectRecord", issues);
}

export function assertPublicQuiz(value: unknown, path = "publicQuiz"): asserts value is PublicQuiz {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  const lessonCode = requiredString(record, "lessonCode", path, issues);
  if (lessonCode && !/^M\d{2}_L\d{2}$/.test(lessonCode)) issues.push(`${path}.lessonCode must match Mxx_Lxx.`);
  requiredString(record, "quizVersion", path, issues);
  const questions = expectArray(record.questions, `${path}.questions`, issues);
  if (questions.length !== 5) issues.push(`${path}.questions must contain exactly five questions.`);
  questions.forEach((question, qIndex) => {
    const item = expectRecord(question, `${path}.questions[${qIndex}]`, issues);
    requiredString(item, "id", `${path}.questions[${qIndex}]`, issues);
    requiredString(item, "questionText", `${path}.questions[${qIndex}]`, issues);
    const options = expectArray(item.options, `${path}.questions[${qIndex}].options`, issues);
    if (options.length !== 4) issues.push(`${path}.questions[${qIndex}].options must contain four options.`);
    options.forEach((option, optionIndex) => {
      const optionRecord = expectRecord(option, `${path}.questions[${qIndex}].options[${optionIndex}]`, issues);
      requiredString(optionRecord, "id", `${path}.questions[${qIndex}].options[${optionIndex}]`, issues);
      requiredString(optionRecord, "text", `${path}.questions[${qIndex}].options[${optionIndex}]`, issues);
    });
  });
  for (const forbidden of ["correctAnswer", "correctLetter", "correctOptionId", "answerKey", "explanation"]) if (forbidden in record) issues.push(`${path} contains server-only field ${forbidden}.`);
  throwIfIssues("PublicQuiz", issues);
}

export function assertServerQuizAnswerSet(value: unknown, path = "serverQuiz"): asserts value is ServerQuizAnswerSet {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  requiredString(record, "lessonCode", path, issues);
  requiredString(record, "quizVersion", path, issues);
  const answers = expectArray(record.answers, `${path}.answers`, issues);
  if (answers.length !== 5) issues.push(`${path}.answers must contain exactly five answers.`);
  answers.forEach((answer, index) => {
    const item = expectRecord(answer, `${path}.answers[${index}]`, issues);
    requiredString(item, "questionId", `${path}.answers[${index}]`, issues);
    requiredString(item, "correctOptionId", `${path}.answers[${index}]`, issues);
    requiredString(item, "explanation", `${path}.answers[${index}]`, issues);
  });
  throwIfIssues("ServerQuizAnswerSet", issues);
}

export function assertContentManifest(value: unknown, path = "manifest"): asserts value is ContentManifest {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  requiredString(record, "schemaVersion", path, issues);
  requiredString(record, "contentVersion", path, issues);
  const generatedAt = requiredString(record, "generatedAt", path, issues);
  if (generatedAt && Number.isNaN(Date.parse(generatedAt))) issues.push(`${path}.generatedAt must be an ISO-compatible timestamp.`);
  if (record.sourcePolicy !== "CLEAN_ALLOWLIST_DEFAULT_DENY") issues.push(`${path}.sourcePolicy must be CLEAN_ALLOWLIST_DEFAULT_DENY.`);

  const counts = expectRecord(record.counts, `${path}.counts`, issues);
  for (const key of ["modules", "lessons", "projects", "quizQuestions"]) positiveInteger(counts, key, `${path}.counts`, issues);
  if (counts.modules !== EXPECTED_COUNTS.modules) issues.push(`${path}.counts.modules must be ${EXPECTED_COUNTS.modules}.`);
  if (counts.lessons !== EXPECTED_COUNTS.lessons) issues.push(`${path}.counts.lessons must be ${EXPECTED_COUNTS.lessons}.`);
  if (counts.projects !== EXPECTED_COUNTS.projects) issues.push(`${path}.counts.projects must be ${EXPECTED_COUNTS.projects}.`);
  if (counts.quizQuestions !== EXPECTED_COUNTS.quizQuestions) issues.push(`${path}.counts.quizQuestions must be ${EXPECTED_COUNTS.quizQuestions}.`);

  const statuses = stringArray(record.statuses, `${path}.statuses`, issues, true);
  if (new Set(statuses).size !== statuses.length) issues.push(`${path}.statuses must not contain duplicates.`);
  const expectedStatuses = new Set<string>(CONTENT_STATUSES);
  if (statuses.length !== expectedStatuses.size || statuses.some((status) => !expectedStatuses.has(status))) issues.push(`${path}.statuses must contain the complete registered ContentStatus set.`);

  const sources = expectArray(record.authoritativeSources, `${path}.authoritativeSources`, issues);
  if (sources.length !== 5) issues.push(`${path}.authoritativeSources must contain exactly five GEN sources.`);
  sources.forEach((source, index) => collect(() => assertSourceProvenance(source, `${path}.authoritativeSources[${index}]`), issues));

  const entities = expectRecord(record.entities, `${path}.entities`, issues);
  const modules = expectArray(entities.modules, `${path}.entities.modules`, issues);
  const lessons = expectArray(entities.lessons, `${path}.entities.lessons`, issues);
  const projects = expectArray(entities.projects, `${path}.entities.projects`, issues);
  const quizzes = expectArray(entities.quizzes, `${path}.entities.quizzes`, issues);
  if (modules.length !== EXPECTED_COUNTS.modules) issues.push(`${path}.entities.modules must contain ${EXPECTED_COUNTS.modules} records.`);
  if (lessons.length !== EXPECTED_COUNTS.lessons) issues.push(`${path}.entities.lessons must contain ${EXPECTED_COUNTS.lessons} records.`);
  if (projects.length !== EXPECTED_COUNTS.projects) issues.push(`${path}.entities.projects must contain ${EXPECTED_COUNTS.projects} records.`);
  if (quizzes.length !== EXPECTED_COUNTS.lessons) issues.push(`${path}.entities.quizzes must contain ${EXPECTED_COUNTS.lessons} records.`);

  validateManifestEntityRefs(modules, `${path}.entities.modules`, /^M\d{2}$/, "code", issues);
  validateManifestEntityRefs(lessons, `${path}.entities.lessons`, /^M\d{2}_L\d{2}$/, "code", issues);
  const projectCodes = new Set<string>();
  projects.forEach((project, index) => {
    const item = expectRecord(project, `${path}.entities.projects[${index}]`, issues);
    const code = requiredString(item, "code", `${path}.entities.projects[${index}]`, issues);
    if (code && !/^M\d{2}_P\d{2}$/.test(code)) issues.push(`${path}.entities.projects[${index}].code must match Mxx_Pxx.`);
    if (code && projectCodes.has(code)) issues.push(`${path}.entities.projects contains duplicate code ${code}.`);
    projectCodes.add(code);
    requiredString(item, "contentVersion", `${path}.entities.projects[${index}]`, issues);
    if (item.formatType !== "SINGLE_BOARD" && item.formatType !== "MULTI_PAGE_PACK") issues.push(`${path}.entities.projects[${index}].formatType is invalid.`);
    if (code === "M08_P08" && item.formatType !== "MULTI_PAGE_PACK") issues.push(`${path}.entities.projects[${index}].formatType must remain MULTI_PAGE_PACK for M08_P08.`);
  });
  const quizCodes = new Set<string>();
  let quizQuestionCount = 0;
  quizzes.forEach((quiz, index) => {
    const item = expectRecord(quiz, `${path}.entities.quizzes[${index}]`, issues);
    const lessonCode = requiredString(item, "lessonCode", `${path}.entities.quizzes[${index}]`, issues);
    if (lessonCode && !/^M\d{2}_L\d{2}$/.test(lessonCode)) issues.push(`${path}.entities.quizzes[${index}].lessonCode must match Mxx_Lxx.`);
    if (lessonCode && quizCodes.has(lessonCode)) issues.push(`${path}.entities.quizzes contains duplicate lessonCode ${lessonCode}.`);
    quizCodes.add(lessonCode);
    requiredString(item, "quizVersion", `${path}.entities.quizzes[${index}]`, issues);
    positiveInteger(item, "questionCount", `${path}.entities.quizzes[${index}]`, issues);
    if (item.questionCount !== EXPECTED_COUNTS.questionsPerLesson) issues.push(`${path}.entities.quizzes[${index}].questionCount must be ${EXPECTED_COUNTS.questionsPerLesson}.`);
    if (typeof item.questionCount === "number") quizQuestionCount += item.questionCount;
  });
  if (quizQuestionCount !== EXPECTED_COUNTS.quizQuestions) issues.push(`${path}.entities.quizzes total questionCount must be ${EXPECTED_COUNTS.quizQuestions}.`);

  const assets = expectArray(record.assetRegistry, `${path}.assetRegistry`, issues);
  assets.forEach((asset, index) => collect(() => assertManifestAssetRecord(asset, `${path}.assetRegistry[${index}]`), issues));

  positiveInteger(record, "aliasCount", path, issues, true);
  positiveInteger(record, "ignoredCount", path, issues, true);
  positiveInteger(record, "duplicateCount", path, issues, true);
  const publicBoundaries = stringArray(record.publicGeneratedBoundaries, `${path}.publicGeneratedBoundaries`, issues, true);
  if (publicBoundaries.length !== 1 || publicBoundaries[0] !== "generated/public") issues.push(`${path}.publicGeneratedBoundaries must equal ["generated/public"].`);
  const serverBoundaries = stringArray(record.serverOnlyGeneratedBoundaries, `${path}.serverOnlyGeneratedBoundaries`, issues, true);
  if (serverBoundaries.length !== 1 || serverBoundaries[0] !== "generated/server") issues.push(`${path}.serverOnlyGeneratedBoundaries must equal ["generated/server"].`);

  throwIfIssues("ContentManifest", issues);
}

export function assertPendingAssetRecord(value: unknown, path = "pending"): asserts value is PendingAssetRecord {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  requiredString(record, "contentCode", path, issues);
  if (record.contentType !== "LESSON" && record.contentType !== "PROJECT") issues.push(`${path}.contentType must be LESSON or PROJECT.`);
  requiredString(record, "role", path, issues);
  contentStatus(record.status, `${path}.status`, issues);
  requiredString(record, "reason", path, issues);
  throwIfIssues("PendingAssetRecord", issues);
}

export function assertAliasRecord(value: unknown, path = "alias"): asserts value is AliasRecord {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  requiredString(record, "sourceFilename", path, issues);
  requiredString(record, "canonicalCode", path, issues);
  if (record.canonicalRole !== "STUDENT_PAGE" && record.canonicalRole !== "EXAMPLE_PPTX") issues.push(`${path}.canonicalRole is invalid.`);
  requiredString(record, "canonicalPublicFilename", path, issues);
  requiredString(record, "reason", path, issues);
  if (typeof record.sourcePresent !== "boolean") issues.push(`${path}.sourcePresent must be boolean.`);
  nullableString(record.sourceRelativePath, `${path}.sourceRelativePath`, issues);
  nullableString(record.sourceSha256, `${path}.sourceSha256`, issues);
  contentStatus(record.status, `${path}.status`, issues);
  if (record.deterministicExactMatch !== true) issues.push(`${path}.deterministicExactMatch must be true.`);
  if (record.fuzzyMatchingUsed !== false) issues.push(`${path}.fuzzyMatchingUsed must be false.`);
  throwIfIssues("AliasRecord", issues);
}

export function assertSanitationRecord(value: unknown, path = "sanitation"): asserts value is SanitationRecord {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  collect(() => assertSourceProvenance(record.source, `${path}.source`), issues);
  if (record.inspectionMode !== "NON_DESTRUCTIVE") issues.push(`${path}.inspectionMode must be NON_DESTRUCTIVE.`);
  contentStatus(record.publicationStatus, `${path}.publicationStatus`, issues);
  expectRecord(record.details, `${path}.details`, issues);
  const warnings = expectArray(record.warnings, `${path}.warnings`, issues);
  warnings.forEach((warning, index) => {
    const item = expectRecord(warning, `${path}.warnings[${index}]`, issues);
    requiredString(item, "code", `${path}.warnings[${index}]`, issues);
    if (!new Set(["low", "medium", "high", "critical"]).has(String(item.severity))) issues.push(`${path}.warnings[${index}].severity is invalid.`);
    requiredString(item, "message", `${path}.warnings[${index}]`, issues);
  });
  throwIfIssues("SanitationRecord", issues);
}

export function assertRouteLanguageMap(value: unknown, path = "routeLanguageMap"): asserts value is RouteLanguageMap {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  requiredString(record, "schemaVersion", path, issues);
  if (record.architecture !== "sectional-language-not-full-localization") issues.push(`${path}.architecture is invalid.`);
  const core = expectRecord(record.core, `${path}.core`, issues);
  const documentary = expectRecord(record.documentary, `${path}.documentary`, issues);
  if (core.language !== "ru" || core.documentLanguage !== "ru" || core.routePrefix !== "/") issues.push(`${path}.core must declare Russian unprefixed semantics.`);
  requiredString(core, "status", `${path}.core`, issues);
  const corePatterns = stringArray(core.patterns, `${path}.core.patterns`, issues, true);
  if (corePatterns.some((route) => route.startsWith("/en"))) issues.push(`${path}.core.patterns must not contain English documentary routes.`);
  if (documentary.language !== "en" || documentary.documentLanguage !== "en" || documentary.routePrefix !== "/en") issues.push(`${path}.documentary must declare English /en semantics.`);
  requiredString(documentary, "status", `${path}.documentary`, issues);
  if (documentary.authenticationRequired !== false) issues.push(`${path}.documentary.authenticationRequired must be false.`);
  if (documentary.inventedBodyCopyAllowed !== false) issues.push(`${path}.documentary.inventedBodyCopyAllowed must be false.`);
  const patterns = stringArray(documentary.patterns, `${path}.documentary.patterns`, issues, true);
  if (patterns.some((route) => !route.startsWith("/en"))) issues.push(`${path}.documentary.patterns must remain inside /en.`);
  if (patterns.some((route) => /(?:lesson|module|project)/i.test(route))) issues.push(`${path}.documentary.patterns must not create an English duplicate course tree.`);
  const requiredDocumentaryRoutes = ["/en", "/en/process", "/en/research", "/en/methodology", "/en/team", "/en/impact", "/en/journal", "/en/journal/[slug]"];
  if (patterns.length !== requiredDocumentaryRoutes.length || requiredDocumentaryRoutes.some((route) => !patterns.includes(route))) issues.push(`${path}.documentary.patterns must contain the complete controlled Phase 10 route family.`);
  const prohibitions = expectRecord(record.prohibitions, `${path}.prohibitions`, issues);
  for (const key of ["globalLanguageSwitch", "duplicateEnglishLessonTree", "machineTranslatedPublishedCopy", "mixedLanguageUncontrolledBodyField"]) {
    if (prohibitions[key] !== true) issues.push(`${path}.prohibitions.${key} must be true.`);
  }
  throwIfIssues("RouteLanguageMap", issues);
}

export function assertCourseRecord(value: unknown, path = "course"): asserts value is CourseRecord {
  const issues: string[] = [];
  const record = expectRecord(value, path, issues);
  if (record.code !== "ARCHSTART") issues.push(`${path}.code must be ARCHSTART.`);
  if (record.name !== "ARCH.START") issues.push(`${path}.name must be ARCH.START.`);
  if (record.languageMode !== "RUSSIAN_FIRST_CORE") issues.push(`${path}.languageMode must be RUSSIAN_FIRST_CORE.`);
  for (const key of ["moduleCount", "lessonCount", "projectCount", "quizQuestionCount"]) positiveInteger(record, key, path, issues);
  if (record.moduleCount !== EXPECTED_COUNTS.modules) issues.push(`${path}.moduleCount must be ${EXPECTED_COUNTS.modules}.`);
  if (record.lessonCount !== EXPECTED_COUNTS.lessons) issues.push(`${path}.lessonCount must be ${EXPECTED_COUNTS.lessons}.`);
  if (record.projectCount !== EXPECTED_COUNTS.projects) issues.push(`${path}.projectCount must be ${EXPECTED_COUNTS.projects}.`);
  if (record.quizQuestionCount !== EXPECTED_COUNTS.quizQuestions) issues.push(`${path}.quizQuestionCount must be ${EXPECTED_COUNTS.quizQuestions}.`);
  throwIfIssues("CourseRecord", issues);
}

function validateManifestEntityRefs(items: unknown[], path: string, codePattern: RegExp, codeField: string, issues: string[]): void {
  const codes = new Set<string>();
  items.forEach((entry, index) => {
    const item = expectRecord(entry, `${path}[${index}]`, issues);
    const code = requiredString(item, codeField, `${path}[${index}]`, issues);
    if (code && !codePattern.test(code)) issues.push(`${path}[${index}].${codeField} has an invalid official code.`);
    if (code && codes.has(code)) issues.push(`${path} contains duplicate ${codeField} ${code}.`);
    codes.add(code);
    requiredString(item, "contentVersion", `${path}[${index}]`, issues);
  });
}

function isSafeRelativePath(value: string): boolean {
  return !value.startsWith("/")
    && !value.includes("\\")
    && !/^[A-Za-z]:[\/]/.test(value)
    && !/(?:^|\/)\.\.(?:\/|$)/.test(value)
    && !/OneDrive/i.test(value);
}

function validateOutcomes(value: unknown, path: string, issues: string[], expectedCount?: number): void {
  const outcomes = expectArray(value, path, issues);
  if (expectedCount !== undefined && outcomes.length !== expectedCount) issues.push(`${path} must contain exactly ${expectedCount} outcomes.`);
  outcomes.forEach((outcome, index) => {
    const record = expectRecord(outcome, `${path}[${index}]`, issues);
    positiveInteger(record, "order", `${path}[${index}]`, issues);
    if (typeof record.label !== "string") issues.push(`${path}[${index}].label must be string.`);
    requiredString(record, "text", `${path}[${index}]`, issues);
    requiredString(record, "sourceText", `${path}[${index}]`, issues);
  });
}

function validateProvenanceArray(value: unknown, path: string, issues: string[]): void {
  const sources = expectArray(value, path, issues);
  sources.forEach((source, index) => collect(() => assertSourceProvenance(source, `${path}[${index}]`), issues));
}

function expectRecord(value: unknown, path: string, issues: string[]): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${path} must be an object.`);
    return {};
  }
  return value as RecordValue;
}

function expectArray(value: unknown, path: string, issues: string[]): unknown[] {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array.`);
    return [];
  }
  return value;
}

function requiredString(record: RecordValue, key: string, path: string, issues: string[]): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(`${path}.${key} must be a non-empty string.`);
    return "";
  }
  return value;
}

function nullableString(value: unknown, path: string, issues: string[]): void {
  if (value !== null && typeof value !== "string") issues.push(`${path} must be string or null.`);
}

function positiveInteger(record: RecordValue, key: string, path: string, issues: string[], allowZero = false): void {
  const value = record[key];
  if (!Number.isInteger(value) || (allowZero ? Number(value) < 0 : Number(value) <= 0)) issues.push(`${path}.${key} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
}

function stringArray(value: unknown, path: string, issues: string[], requireNonEmpty: boolean): string[] {
  const array = expectArray(value, path, issues);
  if (requireNonEmpty && array.length === 0) issues.push(`${path} must not be empty.`);
  if (array.some((item) => typeof item !== "string" || item.trim() === "")) issues.push(`${path} must contain only non-empty strings.`);
  return array.filter((item): item is string => typeof item === "string");
}

function contentStatus(value: unknown, path: string, issues: string[]): void {
  if (typeof value !== "string" || !statusSet.has(value)) issues.push(`${path} must be a registered ContentStatus.`);
}

function collect(action: () => void, issues: string[]): void {
  try {
    action();
  } catch (error) {
    if (error instanceof SchemaValidationError) issues.push(...error.issues);
    else issues.push(error instanceof Error ? error.message : String(error));
  }
}

function throwIfIssues(label: string, issues: string[]): void {
  if (issues.length > 0) throw new SchemaValidationError(label, issues);
}
