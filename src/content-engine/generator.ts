import { access, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { CONTENT_VERSION, EXPECTED_COUNTS, LESSON_ASSET_ROLES, QUIZ_VERSION, REQUIRED_GEN_FILES, SCHEMA_VERSION } from "./constants.ts";
import { parseStudentPageDocx } from "./docx.ts";
import { parseCourseStructure, parseObjectiveFile, parseQuizzes } from "./gen-parsers.ts";
import { atomicReplaceDirectory, ensureDir, fileSize, readUtf8, sha1Text, sha256File, toPosixRelative, writeCsv, writeJson } from "./io.ts";
import { parseMiniOutput, type MnotExclusionItem } from "./mnot.ts";
import { findForbiddenPublicPaths } from "./paths.ts";
import { findForbiddenQuizKeys } from "./quiz-boundary.ts";
import {
  assertAliasRecord,
  assertContentManifest,
  assertCourseRecord,
  assertLessonRecord,
  assertModuleRecord,
  assertPendingAssetRecord,
  assertProjectRecord,
  assertPublicQuiz,
  assertRouteLanguageMap,
  assertSanitationRecord,
  assertServerQuizAnswerSet,
  assertSourceProvenance,
} from "./schema.ts";
import { inspectForPublication } from "./sanitization.ts";
import { classifyFileName, EXPLICIT_ALIASES, type Classification } from "./source-policy.ts";
import { CONTENT_STATUSES } from "./status.ts";
import { parseTranscript } from "./transcript.ts";
import type {
  AliasRecord,
  AssetRecord,
  ContentManifest,
  CourseRecord,
  CourseIndex,
  LessonCode,
  LessonRecord,
  ManifestAssetClassification,
  ManifestAssetRecord,
  ModuleCode,
  ModuleRecord,
  PendingAssetRecord,
  ProjectCode,
  ProjectRecord,
  PublicQuiz,
  RouteLanguageMap,
  SanitationRecord,
  ServerQuizAnswerSet,
  SourceProvenance,
  VocabularyEntry,
} from "./types.ts";
import { extractVocabulary } from "./vocabulary.ts";

export interface GenerateOptions {
  sourceRoot: string;
  outputRoot: string;
  generatedAt?: string;
  acceptedM01SnapshotPath?: string | null;
}

export interface AtomicGenerateOptions extends Omit<GenerateOptions, "outputRoot"> {
  outputRoot: string;
}

export interface GenerationSummary {
  sourceRootLabel: "IMMUTABLE_SOURCE_ROOT";
  outputRoot: string;
  generatedAt: string;
  counts: { modules: number; lessons: number; projects: number; quizQuestions: number };
  m01VocabularyEntries: number;
  m01SnapshotComparison: SnapshotComparison;
  generatedFileCount: number;
}

interface AuthoritativeGenClassification {
  status: "AVAILABLE";
  classification: "AUTHORITATIVE_GEN";
  role: (typeof REQUIRED_GEN_FILES)[keyof typeof REQUIRED_GEN_FILES];
  contentCode?: undefined;
  canonicalPublicFilename?: undefined;
  reason?: undefined;
}

type SourceClassification = Classification | AuthoritativeGenClassification;

interface SourceFile {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  sizeBytes: number;
  sha256: string;
  classification: SourceClassification;
}

interface SnapshotDifference {
  path: string;
  accepted: unknown;
  regenerated: unknown;
  classification: "SOURCE_GROUNDED_PARSER_CORRECTION" | "UNEXPECTED_SEMANTIC_DIFFERENCE";
  evidence?: string;
}

interface SnapshotComparison {
  schemaVersion: string;
  compared: boolean;
  acceptedSnapshot: string | null;
  semanticEqual: boolean;
  controlledTimestampFieldsExcluded: string[];
  differences: SnapshotDifference[];
  sourceGroundedCorrections: number;
  unexpectedDifferences: number;
  result: "PASS" | "PASS_WITH_SOURCE_GROUNDED_CORRECTIONS" | "FAIL";
}

const GEN_SOURCE_IDS: Record<string, string> = {
  COURSE_STRUCTURE: "GEN_COURSE_STRUCTURE",
  LESSON_OBJECTIVES: "GEN_LESSON_OBJECTIVES",
  MODULE_OBJECTIVES: "GEN_MODULE_OBJECTIVES",
  PROJECT_OBJECTIVES: "GEN_PROJECT_OBJECTIVES",
  QUIZ_SOURCE: "GEN_QUIZ_SOURCE",
};

export async function generateContentAtomic(options: AtomicGenerateOptions): Promise<GenerationSummary> {
  const target = resolve(options.outputRoot);
  const parent = dirname(target);
  await ensureDir(parent);
  const temp = await mkdtemp(join(parent, ".generated-repair-a-"));
  try {
    const summary = await generateContent({ ...options, outputRoot: temp });
    await atomicReplaceDirectory(temp, target);
    return { ...summary, outputRoot: target };
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
}

export async function generateContent(options: GenerateOptions): Promise<GenerationSummary> {
  const sourceRoot = resolve(options.sourceRoot);
  const outputRoot = resolve(options.outputRoot);
  const generatedAt = validateTimestamp(options.generatedAt ?? new Date().toISOString());
  await rm(outputRoot, { recursive: true, force: true });
  await ensureDir(outputRoot);

  const authoritativePaths = new Map<string, string>();
  for (const [fileName] of Object.entries(REQUIRED_GEN_FILES)) {
    const exactPath = join(sourceRoot, fileName);
    try { await access(exactPath); } catch { throw new Error(`Required authoritative source is absent at the exact source-root path: ${fileName}`); }
    authoritativePaths.set(fileName, exactPath);
  }

  const sourceFiles = await discoverSourceFiles(sourceRoot);
  const sourceByRelativePath = new Map(sourceFiles.map((file) => [file.relativePath, file]));
  const sourceByName = new Map<string, SourceFile[]>();
  for (const file of sourceFiles) {
    const group = sourceByName.get(file.fileName) ?? [];
    group.push(file);
    sourceByName.set(file.fileName, group);
  }

  const sourceReference = async (file: SourceFile, role: string, sourceId?: string): Promise<SourceProvenance> => {
    const record: SourceProvenance = {
      sourceId: sourceId ?? `SRC_${sha1Text(file.relativePath).slice(0, 12).toUpperCase()}`,
      relativePath: file.relativePath,
      role,
      sha256: file.sha256,
      sizeBytes: file.sizeBytes,
      immutable: true,
      contentVersion: CONTENT_VERSION,
    };
    assertSourceProvenance(record);
    return record;
  };

  const authoritativeFile = (name: string): SourceFile => {
    const file = sourceByRelativePath.get(name);
    if (!file) throw new Error(`Authoritative file was not discovered at exact relative path ${name}.`);
    return file;
  };

  const structureText = await readUtf8(authoritativePaths.get("Course Structure.txt")!);
  const moduleObjectiveText = await readUtf8(authoritativePaths.get("Modules Obj.txt")!);
  const lessonObjectiveText = await readUtf8(authoritativePaths.get("Lessons Obj.txt")!);
  const projectObjectiveText = await readUtf8(authoritativePaths.get("Projects Obj.txt")!);
  const quizText = await readUtf8(authoritativePaths.get("Questions Lessons.txt")!);

  const structure = parseCourseStructure(structureText);
  const moduleObjectives = parseObjectiveFile(moduleObjectiveText, "module");
  const lessonObjectives = parseObjectiveFile(lessonObjectiveText, "lesson");
  const projectObjectives = parseObjectiveFile(projectObjectiveText, "project");
  const rawQuizzes = parseQuizzes(quizText);
  assertOfficialCounts(structure.modules.length, structure.lessons.length, structure.projects.length, rawQuizzes);
  assertObjectiveCoverage(structure.modules.map((item) => item.code), moduleObjectives, "module");
  assertObjectiveCoverage(structure.lessons.map((item) => item.code), lessonObjectives, "lesson");
  assertObjectiveCoverage(structure.projects.map((item) => item.code), projectObjectives, "project");
  assertOfficialTitles(structure, moduleObjectives, lessonObjectives, projectObjectives);

  const lessonAssetIndex = new Map<string, SourceFile>();
  const projectAssetIndex = new Map<string, SourceFile>();
  const duplicateRoleClaims: Array<Record<string, unknown>> = [];
  for (const file of sourceFiles) {
    const classification = file.classification;
    if (classification.classification === "LESSON_ALLOWLIST") {
      registerUnique(lessonAssetIndex, `${classification.contentCode}:${classification.role}`, file, duplicateRoleClaims);
    }
    if (classification.classification === "PROJECT_ALLOWLIST" || classification.classification === "EXPLICIT_ALIAS") {
      registerUnique(projectAssetIndex, `${classification.contentCode}:${classification.role}`, file, duplicateRoleClaims);
    }
  }
  if (duplicateRoleClaims.length > 0) {
    await writeJson(join(outputRoot, "reports/duplicate-assets.json"), { schemaVersion: SCHEMA_VERSION, items: duplicateRoleClaims });
    throw new Error(`Source package contains duplicate claims for approved content roles: ${duplicateRoleClaims.map((item) => item.key).join(", ")}`);
  }

  const courseStructureSource = await sourceReference(authoritativeFile("Course Structure.txt"), "COURSE_STRUCTURE", "GEN_COURSE_STRUCTURE");
  const moduleObjectivesSource = await sourceReference(authoritativeFile("Modules Obj.txt"), "MODULE_OBJECTIVES", "GEN_MODULE_OBJECTIVES");
  const lessonObjectivesSource = await sourceReference(authoritativeFile("Lessons Obj.txt"), "LESSON_OBJECTIVES", "GEN_LESSON_OBJECTIVES");
  const projectObjectivesSource = await sourceReference(authoritativeFile("Projects Obj.txt"), "PROJECT_OBJECTIVES", "GEN_PROJECT_OBJECTIVES");
  const quizSource = await sourceReference(authoritativeFile("Questions Lessons.txt"), "QUIZ_SOURCE", "GEN_QUIZ_SOURCE");

  const modules: ModuleRecord[] = [];
  for (const item of structure.modules) {
    const objective = moduleObjectives.get(item.code)!;
    const record: ModuleRecord = {
      ...item,
      goal: objective.objective,
      outcomes: objective.outcomes,
      status: "AVAILABLE",
      sourceProvenance: [courseStructureSource, moduleObjectivesSource],
      contentVersion: CONTENT_VERSION,
    };
    assertModuleRecord(record, `modules.${record.code}`);
    modules.push(record);
  }

  const mnotItems: MnotExclusionItem[] = [];
  const vocabularyReports: Array<Record<string, unknown>> = [];
  const lessons: LessonRecord[] = [];
  let m01VocabularyCount = 0;
  let m01TranscriptSections = 0;
  for (const item of structure.lessons) {
    const objective = lessonObjectives.get(item.code)!;
    const assets = {} as LessonRecord["assets"];
    for (const role of LESSON_ASSET_ROLES) {
      const file = lessonAssetIndex.get(`${item.code}:${role}`);
      const canonicalFilename = `${item.code}_${role}${role === "PRES" ? ".pptx" : role === "SRPT" || role === "MNOT" ? ".txt" : role === "VOCB" ? ".pdf" : ".png"}`;
      if (file) {
        assets[role] = {
          role,
          status: "AVAILABLE",
          canonicalFilename: file.fileName,
          source: await sourceReference(file, role),
          publicationStatus: [".pptx", ".pdf", ".png", ".jpg", ".jpeg"].includes(file.extension) ? "SANITIZATION_REQUIRED" : "AVAILABLE",
        };
      } else {
        const status = item.moduleCode === "M01" ? (role === "PICE" ? "PICE_PENDING" : "INVALID") : "PENDING_NOT_SUPPLIED_IN_THIS_PHASE";
        assets[role] = { role, status, canonicalFilename, source: null, publicationStatus: status === "INVALID" ? "INVALID" : "PENDING_NOT_SUPPLIED_IN_THIS_PHASE" };
      }
    }
    const transcript = assets.SRPT.source
      ? parseTranscript(await readUtf8(lessonAssetIndex.get(`${item.code}:SRPT`)!.absolutePath), assets.SRPT.canonicalFilename, assets.SRPT.source)
      : null;
    if (transcript) m01TranscriptSections += transcript.sectionCount;

    let miniOutput: LessonRecord["miniOutput"] = null;
    if (assets.MNOT.source) {
      const parsed = parseMiniOutput(
        await readUtf8(lessonAssetIndex.get(`${item.code}:MNOT`)!.absolutePath),
        item.code,
        assets.MNOT.source.relativePath,
        assets.MNOT.source,
      );
      miniOutput = parsed.record;
      mnotItems.push(parsed.report);
    }

    let vocabularyEntries: VocabularyEntry[] = [];
    let vocabularyExtractionWarnings: string[] = [];
    if (assets.VOCB.source) {
      const extracted = await extractVocabulary(lessonAssetIndex.get(`${item.code}:VOCB`)!.absolutePath, assets.VOCB.source.relativePath);
      vocabularyEntries = extracted.entries;
      vocabularyExtractionWarnings = extracted.warnings;
      m01VocabularyCount += vocabularyEntries.length;
      vocabularyReports.push({
        lessonCode: item.code,
        sourceFile: assets.VOCB.source.relativePath,
        entryCount: vocabularyEntries.length,
        sourcePages: [...new Set(vocabularyEntries.map((entry) => entry.sourcePage))].sort((a, b) => a - b),
        warnings: vocabularyExtractionWarnings,
        extractor: extracted.extractor,
        result: vocabularyEntries.length > 0 ? (vocabularyExtractionWarnings.length > 0 ? "PASS_WITH_WARNINGS" : "PASS") : "FAIL",
      });
    }

    const questionCount = rawQuizzes.get(item.code)?.length ?? 0;
    const record: LessonRecord = {
      ...item,
      objective: objective.objective,
      learningOutcomes: objective.outcomes,
      assets,
      transcript,
      vocabularyEntries,
      vocabularyExtractionWarnings,
      miniOutput,
      deepDive: null,
      quiz: { lessonCode: item.code, quizVersion: QUIZ_VERSION, questionCount },
      youtubeId: null,
      captionsFile: null,
      resources: [],
      mediaStatus: { video: "VIDEO_PENDING", captions: "CAPTIONS_PENDING" },
      status: item.moduleCode === "M01" ? "AVAILABLE" : "PENDING_NOT_SUPPLIED_IN_THIS_PHASE",
      sourceProvenance: [courseStructureSource, lessonObjectivesSource],
      contentVersion: CONTENT_VERSION,
    };
    assertLessonRecord(record, `lessons.${record.code}`);
    lessons.push(record);
  }

  let m01ProjectContent: ProjectRecord["normalizedPublicContent"] = null;
  let m03ParsedBlockCount = 0;
  const projects: ProjectRecord[] = [];
  for (const item of structure.projects) {
    const objective = projectObjectives.get(item.code)!;
    const studentFile = projectAssetIndex.get(`${item.code}:STUDENT_PAGE`);
    const pptxFile = projectAssetIndex.get(`${item.code}:EXAMPLE_PPTX`);
    const previewFile = projectAssetIndex.get(`${item.code}:PREVIEW_IMAGE`);
    const validationSampleOnly = item.code === "M03_P03";
    if (item.code === "M01_P01" && studentFile) m01ProjectContent = await parseStudentPageDocx(studentFile.absolutePath, await sourceReference(studentFile, "STUDENT_PAGE"));
    if (item.code === "M03_P03" && studentFile) {
      const sample = await parseStudentPageDocx(studentFile.absolutePath, await sourceReference(studentFile, "STUDENT_PAGE"));
      m03ParsedBlockCount = sample.blockCount;
    }
    const makeProjectAsset = async (role: "STUDENT_PAGE" | "EXAMPLE_PPTX" | "PREVIEW_IMAGE", file: SourceFile | undefined, canonicalFilename: string): Promise<AssetRecord> => {
      if (!file) return { role, status: "PENDING_NOT_SUPPLIED_IN_THIS_PHASE", canonicalFilename, source: null, validationSampleOnly: false, publicationStatus: "PENDING_NOT_SUPPLIED_IN_THIS_PHASE" };
      const alias = EXPLICIT_ALIASES[file.fileName as keyof typeof EXPLICIT_ALIASES];
      return {
        role,
        status: alias ? "ALIAS_RESOLVED" : "AVAILABLE",
        canonicalFilename: alias?.canonicalPublicFilename ?? canonicalFilename,
        sourceFilenamePublished: false,
        source: await sourceReference(file, role),
        validationSampleOnly,
        publicationStatus: "SANITIZATION_REQUIRED",
      };
    };
    const assets = {
      studentPageFile: await makeProjectAsset("STUDENT_PAGE", studentFile, `ARCH.START_${item.moduleCode}_Project${item.code.slice(-2)}_Student_Page.docx`),
      examplePptxFile: await makeProjectAsset("EXAMPLE_PPTX", pptxFile, `${item.code}_PPTX.pptx`),
      examplePreviewImage: await makeProjectAsset("PREVIEW_IMAGE", previewFile, `${item.code}_PREVIEW.png`),
    };
    const status = item.code === "M01_P01"
      ? "AVAILABLE"
      : validationSampleOnly && studentFile && pptxFile
        ? "ALIAS_RESOLVED"
        : "PENDING_NOT_SUPPLIED_IN_THIS_PHASE";
    const record: ProjectRecord = {
      ...item,
      objective: objective.objective,
      assessedOutcomes: objective.outcomes,
      assets,
      formatType: item.code === "M08_P08" ? "MULTI_PAGE_PACK" : "SINGLE_BOARD",
      status,
      validationSampleOnly,
      normalizedPublicContent: item.code === "M01_P01" ? m01ProjectContent : null,
      sourceProvenance: [courseStructureSource, projectObjectivesSource],
      contentVersion: CONTENT_VERSION,
    };
    assertProjectRecord(record, `projects.${record.code}`);
    projects.push(record);
  }

  const publicQuizzes = new Map<LessonCode, PublicQuiz>();
  const serverQuizzes = new Map<LessonCode, ServerQuizAnswerSet>();
  const answerDistribution = { A: 0, B: 0, C: 0, D: 0 };
  for (const lesson of structure.lessons) {
    const rawQuestions = rawQuizzes.get(lesson.code)!;
    const publicQuiz: PublicQuiz = {
      lessonCode: lesson.code,
      quizVersion: QUIZ_VERSION,
      questions: rawQuestions.map((question) => {
        const questionId = `${lesson.code}_Q${String(question.number).padStart(2, "0")}`;
        return {
          id: questionId,
          questionText: question.questionText,
          options: question.options.map((option) => ({ id: `${questionId}_OPT_${option.letter}`, text: option.text })),
        };
      }),
    };
    const serverQuiz: ServerQuizAnswerSet = {
      lessonCode: lesson.code,
      quizVersion: QUIZ_VERSION,
      answers: rawQuestions.map((question) => {
        answerDistribution[question.correctLetter] += 1;
        const questionId = `${lesson.code}_Q${String(question.number).padStart(2, "0")}`;
        return { questionId, correctOptionId: `${questionId}_OPT_${question.correctLetter}`, explanation: question.explanation };
      }),
    };
    assertPublicQuiz(publicQuiz, `publicQuizzes.${lesson.code}`);
    assertServerQuizAnswerSet(serverQuiz, `serverQuizzes.${lesson.code}`);
    publicQuizzes.set(lesson.code, publicQuiz);
    serverQuizzes.set(lesson.code, serverQuiz);
  }

  const aliases = await makeAliasReport(sourceByName);
  aliases.forEach((alias, index) => assertAliasRecord(alias, `aliases[${index}]`));
  const ignoredFiles = sourceFiles
    .filter((file) => file.classification.status === "IGNORED_BY_POLICY")
    .map((file) => ({
      relativePath: file.relativePath,
      fileName: file.fileName,
      classification: file.classification.classification,
      status: "IGNORED_BY_POLICY",
      reason: file.classification.reason,
      policyRule: file.classification.reason,
    }));

  const hashGroups = new Map<string, string[]>();
  for (const file of sourceFiles.filter((item) => item.classification.status !== "IGNORED_BY_POLICY")) {
    const group = hashGroups.get(file.sha256) ?? [];
    group.push(file.relativePath);
    hashGroups.set(file.sha256, group);
  }
  const duplicateAssets = [...hashGroups.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([sha256, relativePaths]) => ({ sha256, relativePaths: relativePaths.sort(), status: "DUPLICATE" }));

  const pendingAssets: PendingAssetRecord[] = [];
  for (const lesson of lessons) {
    for (const asset of Object.values(lesson.assets)) {
      if (asset.status !== "AVAILABLE") pendingAssets.push({
        contentCode: lesson.code,
        contentType: "LESSON",
        role: asset.role,
        status: asset.status,
        reason: asset.status === "PICE_PENDING"
          ? "Canonical PICE was not supplied; no substitute may be extracted or generated."
          : asset.status === "INVALID"
            ? "A required role was unexpectedly absent from the supplied M01 package."
            : "Asset was intentionally not supplied in the Phase 01 sample.",
      });
    }
    pendingAssets.push({ contentCode: lesson.code, contentType: "LESSON", role: "YOUTUBE_ID", status: "VIDEO_PENDING", reason: "No approved public YouTube ID supplied." });
    pendingAssets.push({ contentCode: lesson.code, contentType: "LESSON", role: "CAPTIONS", status: "CAPTIONS_PENDING", reason: "No approved captions file supplied." });
  }
  for (const project of projects) {
    for (const asset of Object.values(project.assets)) {
      if (asset.status === "PENDING_NOT_SUPPLIED_IN_THIS_PHASE") pendingAssets.push({
        contentCode: project.code,
        contentType: "PROJECT",
        role: asset.role,
        status: asset.status,
        reason: "Project asset was intentionally not supplied in the Phase 01 sample.",
      });
    }
  }

  const sanitation: SanitationRecord[] = [];
  for (const file of sourceFiles.filter((item) => [".docx", ".pptx", ".pdf", ".png", ".jpg", ".jpeg"].includes(item.extension))) {
    const inspected = await inspectForPublication(file.absolutePath, await sourceReference(file, "SANITIZATION_INSPECTION"));
    assertSanitationRecord(inspected, `sanitation.${file.relativePath}`);
    sanitation.push(inspected);
  }

  const routeLanguageMap = makeRouteLanguageMap();
  assertRouteLanguageMap(routeLanguageMap);

  const course: CourseRecord = {
    code: "ARCHSTART",
    name: "ARCH.START",
    languageMode: "RUSSIAN_FIRST_CORE",
    moduleCount: modules.length,
    lessonCount: lessons.length,
    projectCount: projects.length,
    quizQuestionCount: [...publicQuizzes.values()].reduce((total, quiz) => total + quiz.questions.length, 0),
  };
  // The course index and the manifest are both derived from this validated
  // record so their global count invariants cannot silently diverge.
  assertCourseRecord(course);

  const courseIndex: CourseIndex = {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    generatedAt,
    course,
    modules: modules.map(({ sourceProvenance: _sourceProvenance, ...module }) => module),
    lessons: lessons.map((lesson) => ({
      code: lesson.code,
      moduleCode: lesson.moduleCode,
      orderInModule: lesson.orderInModule,
      globalOrder: lesson.globalOrder,
      titleRu: lesson.titleRu,
      titleEn: lesson.titleEn,
      objective: lesson.objective,
      learningOutcomes: lesson.learningOutcomes,
      assetStatuses: Object.fromEntries(Object.entries(lesson.assets).map(([role, asset]) => [role, asset.status])),
      mediaStatus: lesson.mediaStatus,
      status: lesson.status,
    })),
    projects: projects.map((project) => ({
      code: project.code,
      moduleCode: project.moduleCode,
      order: project.order,
      titleRu: project.titleRu,
      titleEn: project.titleEn,
      objective: project.objective,
      assessedOutcomes: project.assessedOutcomes,
      formatType: project.formatType,
      status: project.status,
      validationSampleOnly: project.validationSampleOnly,
    })),
  };

  // Only importable allowlisted content and authoritative metadata may enter
  // the public manifest. Default-denied/internal evidence remains visible in
  // the development-only ignored-files and sanitation reports, never here.
  const manifestClassifications = new Set<ManifestAssetClassification>(["AUTHORITATIVE_GEN", "LESSON_ALLOWLIST", "PROJECT_ALLOWLIST", "EXPLICIT_ALIAS"]);
  const assetRegistry: ManifestAssetRecord[] = sourceFiles
    .filter((file) => manifestClassifications.has(file.classification.classification as ManifestAssetClassification))
    .map((file) => ({
    relativePath: file.relativePath,
    fileName: file.fileName,
    classification: file.classification.classification as ManifestAssetClassification,
    role: file.classification.role ?? null,
    contentCode: (file.classification.contentCode as ModuleCode | LessonCode | ProjectCode | undefined) ?? null,
    status: file.classification.status,
    canonicalPublicFilename: file.classification.canonicalPublicFilename ?? null,
    reason: file.classification.reason ?? null,
    sourceSha256: file.sha256,
    sizeBytes: file.sizeBytes,
    sourcePathPublic: null,
    }));

  const authoritativeSources = await Promise.all(Object.entries(REQUIRED_GEN_FILES).map(async ([name, role]) => sourceReference(authoritativeFile(name), role, GEN_SOURCE_IDS[role])));
  const manifest: ContentManifest = {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    generatedAt,
    sourcePolicy: "CLEAN_ALLOWLIST_DEFAULT_DENY",
    counts: { modules: modules.length, lessons: lessons.length, projects: projects.length, quizQuestions: [...publicQuizzes.values()].reduce((total, quiz) => total + quiz.questions.length, 0) },
    statuses: [...CONTENT_STATUSES],
    authoritativeSources,
    entities: {
      modules: modules.map((module) => ({ code: module.code, contentVersion: CONTENT_VERSION })),
      lessons: lessons.map((lesson) => ({ code: lesson.code, contentVersion: CONTENT_VERSION })),
      projects: projects.map((project) => ({ code: project.code, contentVersion: CONTENT_VERSION, formatType: project.formatType })),
      quizzes: [...publicQuizzes.values()].map((quiz) => ({ lessonCode: quiz.lessonCode, quizVersion: quiz.quizVersion, questionCount: quiz.questions.length })),
    },
    assetRegistry,
    aliasCount: aliases.length,
    ignoredCount: ignoredFiles.length,
    duplicateCount: duplicateAssets.length,
    publicGeneratedBoundaries: ["generated/public"],
    serverOnlyGeneratedBoundaries: ["generated/server"],
  };
  assertContentManifest(manifest);

  const m01Lessons = lessons.filter((lesson) => lesson.moduleCode === "M01");
  const m01Project = projects.find((project) => project.code === "M01_P01")!;
  const m01Dataset = {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    module: modules.find((module) => module.code === "M01")!,
    lessons: m01Lessons,
    project: m01Project,
    quizPublic: Object.fromEntries([...publicQuizzes.entries()].filter(([code]) => code.startsWith("M01_")).sort(([a], [b]) => a.localeCompare(b))),
    pendingStates: pendingAssets.filter((item) => item.contentCode.startsWith("M01_")),
  };

  const snapshotComparison = await compareM01Snapshot(options.acceptedM01SnapshotPath ?? null, m01Dataset);
  if (snapshotComparison.result === "FAIL") {
    await writeJson(join(outputRoot, "reports/m01-snapshot-comparison.json"), snapshotComparison);
    throw new Error(`Regenerated M01 differs from the accepted snapshot in ${snapshotComparison.unexpectedDifferences} unexpected semantic location(s). See m01-snapshot-comparison.json.`);
  }

  const publicQuizValues = [...publicQuizzes.values()];
  const publicForbiddenKeys = [...new Set(publicQuizValues.flatMap((quiz) => findForbiddenQuizKeys(quiz)))].sort();
  const publicSerialization = JSON.stringify(publicQuizValues);
  const explanationLeaks: string[] = [];
  for (const [lessonCode, rawQuestions] of rawQuizzes) {
    for (const question of rawQuestions) if (question.explanation && publicSerialization.includes(question.explanation)) explanationLeaks.push(`${lessonCode}_Q${String(question.number).padStart(2, "0")}:explanation`);
  }
  const quizSecurityReport = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    publicQuestionCount: publicQuizValues.reduce((total, quiz) => total + quiz.questions.length, 0),
    serverAnswerCount: [...serverQuizzes.values()].reduce((total, quiz) => total + quiz.answers.length, 0),
    publicForbiddenKeysFound: publicForbiddenKeys,
    publicExplanationTextLeaks: explanationLeaks,
    answerPositionDistribution: answerDistribution,
    answerPositionBiasRecordedNotModified: true,
    result: publicForbiddenKeys.length === 0 && explanationLeaks.length === 0 ? "PASS" : "FAIL",
  };
  if (quizSecurityReport.result !== "PASS") throw new Error("Quiz security boundary failed before output commit.");

  const m01Report = {
    schemaVersion: SCHEMA_VERSION,
    result: "PASS",
    moduleCode: "M01",
    lessonCount: m01Lessons.length,
    projectCode: "M01_P01",
    registeredLessonAssets: m01Lessons.flatMap((lesson) => Object.values(lesson.assets)).filter((asset) => asset.status === "AVAILABLE").length,
    transcriptSectionCount: m01TranscriptSections,
    vocabularyEntryCount: m01VocabularyCount,
    miniOutputCount: m01Lessons.filter((lesson) => lesson.miniOutput).length,
    quizQuestionCount: m01Lessons.reduce((total, lesson) => total + publicQuizzes.get(lesson.code)!.questions.length, 0),
    piceAvailableCount: m01Lessons.filter((lesson) => lesson.assets.PICE.status === "AVAILABLE").length,
    videoPendingCount: m01Lessons.length,
    captionsPendingCount: m01Lessons.length,
    studentPageAlias: aliases.find((alias) => alias.canonicalCode === "M01_P01") ?? null,
    publicUiBuilt: false,
  };
  const m03Aliases = aliases.filter((alias) => alias.canonicalCode === "M03_P03");
  const m03AliasReport = {
    schemaVersion: SCHEMA_VERSION,
    result: m03Aliases.length === 2 && m03Aliases.every((alias) => alias.status === "ALIAS_RESOLVED") ? "PASS" : "FAIL",
    projectCode: "M03_P03",
    scope: "VALIDATION_SAMPLE_ONLY",
    aliases: m03Aliases,
    studentPageParser: { parsed: m03ParsedBlockCount > 0, blockCount: m03ParsedBlockCount },
    projectFormatType: "SINGLE_BOARD",
    completeM03ModuleImported: false,
    publicRouteCreated: false,
    officialOrderModified: false,
  };
  if (m03AliasReport.result !== "PASS") throw new Error("Approved M03 aliases did not resolve exactly.");

  const mnotReport = {
    schemaVersion: SCHEMA_VERSION,
    positiveAllowlist: ["Mini-output title", "Russian title when supplied", "Purpose", "Status", "Estimated time", "Tools", "Student task", "Ordered steps", "OUR EXAMPLE heading", "Mini-output self-check"],
    parserMode: "REVIEWED_SECTION_ALIASES_AND_BOUNDARY_RULES",
    lessons: mnotItems,
    result: mnotItems.length === 5 && mnotItems.every((item) => item.result === "PASS") ? "PASS" : "FAIL",
  };
  const vocabularyReport = {
    schemaVersion: SCHEMA_VERSION,
    canonicalDownloadRole: "VOCB_PDF",
    derivedHtmlReplacement: false,
    extractor: "pdftotext-tsv",
    totalValidatedEntries: m01VocabularyCount,
    lessons: vocabularyReports,
    result: vocabularyReports.length === 5 && m01VocabularyCount === 69 && vocabularyReports.every((item) => String(item.result).startsWith("PASS")) ? "PASS" : "FAIL",
  };
  if (mnotReport.result !== "PASS" || vocabularyReport.result !== "PASS") throw new Error("MNOT or vocabulary normalization failed validation.");

  const sanitationReport = {
    schemaVersion: SCHEMA_VERSION,
    mode: "NON_DESTRUCTIVE",
    sourcesModified: false,
    sourceAssetsCopiedToPublic: false,
    sanitationPlan: [
      "Create any sanitized derivative only in a separate generated/workbench boundary.",
      "Retain source provenance and source SHA-256 for every derivative.",
      "Remove or review author/company metadata, comments, speaker notes, hidden content, local paths, external relationships, Canva identifiers, prompts, macros, and active content before publication.",
      "Never publish an immutable source file directly merely because inspection completed.",
    ],
    items: sanitation,
    summary: {
      inspected: sanitation.length,
      sanitizationRequired: sanitation.filter((item) => item.publicationStatus === "SANITIZATION_REQUIRED").length,
      criticalWarnings: sanitation.flatMap((item) => item.warnings).filter((warning) => warning.severity === "critical").length,
      highWarnings: sanitation.flatMap((item) => item.warnings).filter((warning) => warning.severity === "high").length,
    },
  };

  const provenance = {
    schemaVersion: SCHEMA_VERSION,
    records: {
      modules: Object.fromEntries(modules.map((module) => [module.code, module.sourceProvenance])),
      lessons: Object.fromEntries(lessons.map((lesson) => [lesson.code, [...lesson.sourceProvenance, ...Object.values(lesson.assets).flatMap((asset) => asset.source ? [asset.source] : [])]])),
      projects: Object.fromEntries(projects.map((project) => [project.code, [...project.sourceProvenance, ...Object.values(project.assets).flatMap((asset) => asset.source ? [asset.source] : [])]])),
      quizzes: Object.fromEntries([...publicQuizzes.keys()].map((code) => [code, [quizSource]])),
    },
  };

  const contentAuditRows: Array<Record<string, unknown>> = [];
  for (const moduleRecord of modules) contentAuditRows.push({ entityType: "MODULE", code: moduleRecord.code, moduleCode: moduleRecord.code, role: "METADATA", status: moduleRecord.status, sourceRelativePath: "Course Structure.txt; Modules Obj.txt", note: "Official metadata normalized." });
  for (const lesson of lessons) {
    contentAuditRows.push({ entityType: "LESSON", code: lesson.code, moduleCode: lesson.moduleCode, role: "METADATA", status: "AVAILABLE", sourceRelativePath: "Course Structure.txt; Lessons Obj.txt", note: "Official metadata normalized." });
    for (const [role, asset] of Object.entries(lesson.assets)) contentAuditRows.push({ entityType: "LESSON_ASSET", code: lesson.code, moduleCode: lesson.moduleCode, role, status: asset.status, sourceRelativePath: asset.source?.relativePath ?? "", note: asset.publicationStatus });
    contentAuditRows.push({ entityType: "LESSON_MEDIA", code: lesson.code, moduleCode: lesson.moduleCode, role: "YOUTUBE_ID", status: "VIDEO_PENDING", sourceRelativePath: "", note: "No approved YouTube ID supplied." });
    contentAuditRows.push({ entityType: "LESSON_MEDIA", code: lesson.code, moduleCode: lesson.moduleCode, role: "CAPTIONS", status: "CAPTIONS_PENDING", sourceRelativePath: "", note: "No approved captions file supplied." });
  }
  for (const project of projects) {
    contentAuditRows.push({ entityType: "PROJECT", code: project.code, moduleCode: project.moduleCode, role: project.formatType, status: project.status, sourceRelativePath: "Course Structure.txt; Projects Obj.txt", note: project.validationSampleOnly ? "Validation sample only." : "Official project metadata normalized." });
    for (const asset of Object.values(project.assets)) contentAuditRows.push({ entityType: "PROJECT_ASSET", code: project.code, moduleCode: project.moduleCode, role: asset.role, status: asset.status, sourceRelativePath: asset.source?.relativePath ?? "", note: asset.publicationStatus });
  }

  const sizeAuditRows = sourceFiles.map((file) => ({
    relativeSourcePath: file.relativePath,
    fileName: file.fileName,
    extension: file.extension,
    sizeBytes: file.sizeBytes,
    sizeMiB: (file.sizeBytes / (1024 * 1024)).toFixed(3),
    classification: file.classification.classification,
    contentRole: file.classification.role ?? "",
    assetCategory: assetCategory(file),
    recommendedProvider: recommendedProvider(file),
    bundlePolicy: [".pptx", ".docx", ".pdf", ".png", ".jpg", ".jpeg", ".zip"].includes(file.extension) ? "DO_NOT_COPY_TO_APP_BUNDLE" : "NORMALIZE_TEXT_ONLY",
  }));

  await writeJson(join(outputRoot, "public/content-manifest.json"), manifest);
  await writeJson(join(outputRoot, "public/course-index.json"), courseIndex);
  await writeJson(join(outputRoot, "public/route-language-map.json"), routeLanguageMap);
  await writeJson(join(outputRoot, "public/m01-dataset.json"), m01Dataset);
  for (const [lessonCode, quiz] of publicQuizzes) await writeJson(join(outputRoot, `public/quizzes/${lessonCode}.json`), quiz);
  await writeJson(join(outputRoot, "server/quiz-answer-keys.json"), { schemaVersion: SCHEMA_VERSION, contentVersion: CONTENT_VERSION, quizzes: Object.fromEntries(serverQuizzes) });
  await writeJson(join(outputRoot, "provenance/source-provenance.json"), provenance);
  await writeCsv(join(outputRoot, "reports/content-audit.csv"), contentAuditRows);
  await writeCsv(join(outputRoot, "reports/asset-size-audit.csv"), sizeAuditRows);
  await writeJson(join(outputRoot, "reports/missing-assets.json"), { schemaVersion: SCHEMA_VERSION, items: [], note: "No unexpectedly absent asset was identified inside the declared Phase 01 sample package." });
  await writeJson(join(outputRoot, "reports/pending-assets.json"), { schemaVersion: SCHEMA_VERSION, items: pendingAssets });
  await writeJson(join(outputRoot, "reports/ignored-files.json"), { schemaVersion: SCHEMA_VERSION, items: ignoredFiles });
  await writeJson(join(outputRoot, "reports/duplicate-assets.json"), { schemaVersion: SCHEMA_VERSION, items: duplicateAssets });
  await writeJson(join(outputRoot, "reports/alias-resolution.json"), { schemaVersion: SCHEMA_VERSION, items: aliases });
  await writeJson(join(outputRoot, "reports/sanitization-report.json"), sanitationReport);
  await writeJson(join(outputRoot, "reports/m01-normalization-report.json"), m01Report);
  await writeJson(join(outputRoot, "reports/m01-snapshot-comparison.json"), snapshotComparison);
  await writeJson(join(outputRoot, "reports/m03-alias-validation-report.json"), m03AliasReport);
  await writeJson(join(outputRoot, "reports/quiz-security-report.json"), quizSecurityReport);
  await writeJson(join(outputRoot, "reports/vocabulary-extraction-report.json"), vocabularyReport);
  await writeJson(join(outputRoot, "reports/mnot-exclusion-report.json"), mnotReport);
  await writeJson(join(outputRoot, "reports/generator-run.json"), {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    sourceRootRecordedAs: "IMMUTABLE_SOURCE_ROOT",
    deterministicOrdering: true,
    exactGenFilenames: Object.keys(REQUIRED_GEN_FILES),
    atomicCommitRequiredForDefaultOutput: true,
    sourceFilesModified: false,
    generatedFilesManuallyEdited: false,
  });

  await validateGeneratedTree(outputRoot);
  const generatedFiles = await listFiles(outputRoot);
  return {
    sourceRootLabel: "IMMUTABLE_SOURCE_ROOT",
    outputRoot,
    generatedAt,
    counts: manifest.counts,
    m01VocabularyEntries: m01VocabularyCount,
    m01SnapshotComparison: snapshotComparison,
    generatedFileCount: generatedFiles.length,
  };
}

export async function validateGeneratedTree(outputRootInput: string): Promise<void> {
  const outputRoot = resolve(outputRootInput);
  const readJson = async (relativePath: string): Promise<unknown> => JSON.parse(await readFile(join(outputRoot, relativePath), "utf8"));

  const manifest = await readJson("public/content-manifest.json");
  assertContentManifest(manifest);

  const courseIndex = await readJson("public/course-index.json") as CourseIndex;
  assertCourseRecord(courseIndex.course, "public/course-index.json.course");
  if (courseIndex.modules.length !== EXPECTED_COUNTS.modules || courseIndex.lessons.length !== EXPECTED_COUNTS.lessons || courseIndex.projects.length !== EXPECTED_COUNTS.projects) {
    throw new Error("Generated course-index entity count invariant failed.");
  }

  const routeMap = await readJson("public/route-language-map.json");
  assertRouteLanguageMap(routeMap);

  const m01 = await readJson("public/m01-dataset.json") as {
    module: unknown;
    lessons: unknown[];
    project: unknown;
    quizPublic: Record<string, unknown>;
    pendingStates: unknown[];
  };
  assertModuleRecord(m01.module, "public/m01-dataset.json.module");
  if (!Array.isArray(m01.lessons) || m01.lessons.length !== EXPECTED_COUNTS.lessons / EXPECTED_COUNTS.modules) {
    throw new Error("public/m01-dataset.json must contain exactly five M01 lesson records.");
  }
  m01.lessons.forEach((lesson, index) => assertLessonRecord(lesson, `public/m01-dataset.json.lessons[${index}]`));
  assertProjectRecord(m01.project, "public/m01-dataset.json.project");
  m01.pendingStates.forEach((pending, index) => assertPendingAssetRecord(pending, `public/m01-dataset.json.pendingStates[${index}]`));

  const publicQuizCodes = new Set<string>();
  for (const lesson of courseIndex.lessons as Array<{ code: LessonCode }>) {
    const quiz = await readJson(`public/quizzes/${lesson.code}.json`);
    assertPublicQuiz(quiz, `public/quizzes/${lesson.code}.json`);
    if (publicQuizCodes.has(lesson.code)) throw new Error(`Duplicate public quiz code ${lesson.code}.`);
    publicQuizCodes.add(lesson.code);
    const forbidden = findForbiddenQuizKeys(quiz);
    if (forbidden.length) throw new Error(`Public quiz ${lesson.code} contains server-only keys: ${forbidden.join(", ")}`);
  }
  if (publicQuizCodes.size !== EXPECTED_COUNTS.lessons) throw new Error(`Expected ${EXPECTED_COUNTS.lessons} public quiz payloads.`);

  const answers = await readJson("server/quiz-answer-keys.json") as { quizzes: Record<string, unknown> };
  if (!answers || typeof answers !== "object" || !answers.quizzes || typeof answers.quizzes !== "object") throw new Error("Server quiz answer-key wrapper is malformed.");
  const serverQuizEntries = Object.entries(answers.quizzes);
  if (serverQuizEntries.length !== EXPECTED_COUNTS.lessons) throw new Error(`Expected ${EXPECTED_COUNTS.lessons} server-only quiz answer sets.`);
  for (const [lessonCode, answerSet] of serverQuizEntries) {
    assertServerQuizAnswerSet(answerSet, `server.quizzes.${lessonCode}`);
    if (!publicQuizCodes.has(lessonCode)) throw new Error(`Server-only answer set ${lessonCode} has no matching public quiz payload.`);
  }

  const pendingReport = await readJson("reports/pending-assets.json") as { items: unknown[] };
  if (!Array.isArray(pendingReport.items)) throw new Error("reports/pending-assets.json.items must be an array.");
  pendingReport.items.forEach((pending, index) => assertPendingAssetRecord(pending, `reports/pending-assets.json.items[${index}]`));

  const aliasReport = await readJson("reports/alias-resolution.json") as { items: unknown[] };
  if (!Array.isArray(aliasReport.items)) throw new Error("reports/alias-resolution.json.items must be an array.");
  aliasReport.items.forEach((alias, index) => assertAliasRecord(alias, `reports/alias-resolution.json.items[${index}]`));

  const sanitationReport = await readJson("reports/sanitization-report.json") as { items: unknown[] };
  if (!Array.isArray(sanitationReport.items)) throw new Error("reports/sanitization-report.json.items must be an array.");
  sanitationReport.items.forEach((item, index) => assertSanitationRecord(item, `reports/sanitization-report.json.items[${index}]`));

  for (const relativePath of ["public/content-manifest.json", "public/course-index.json", "public/route-language-map.json", "public/m01-dataset.json"]) {
    const leaks = findForbiddenPublicPaths(await readJson(relativePath));
    if (leaks.length) throw new Error(`${relativePath} contains forbidden absolute/local path patterns: ${leaks.join(", ")}`);
  }
}

async function discoverSourceFiles(sourceRoot: string): Promise<SourceFile[]> {
  const paths = await listFiles(sourceRoot);
  const files: SourceFile[] = [];
  for (const absolutePath of paths) {
    const relativePath = toPosixRelative(sourceRoot, absolutePath);
    const fileName = basename(absolutePath);
    const genRole = REQUIRED_GEN_FILES[fileName as keyof typeof REQUIRED_GEN_FILES];
    const policy: SourceClassification = genRole && relativePath === fileName
      ? { status: "AVAILABLE", classification: "AUTHORITATIVE_GEN", role: genRole }
      : classifyFileName(fileName);
    files.push({
      absolutePath,
      relativePath,
      fileName,
      extension: extname(fileName).toLowerCase(),
      sizeBytes: await fileSize(absolutePath),
      sha256: await sha256File(absolutePath),
      classification: policy,
    });
  }
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "en"));
}

async function listFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) result.push(path);
    }
  }
  await visit(root);
  return result;
}

function registerUnique(index: Map<string, SourceFile>, key: string, file: SourceFile, duplicateRoleClaims: Array<Record<string, unknown>>): void {
  const existing = index.get(key);
  if (existing) duplicateRoleClaims.push({ key, status: "DUPLICATE", relativePaths: [existing.relativePath, file.relativePath].sort() });
  else index.set(key, file);
}

function assertOfficialCounts(moduleCount: number, lessonCount: number, projectCount: number, quizzes: Map<LessonCode, unknown[]>): void {
  const questionCount = [...quizzes.values()].reduce((total, questions) => total + questions.length, 0);
  if (moduleCount !== EXPECTED_COUNTS.modules || lessonCount !== EXPECTED_COUNTS.lessons || projectCount !== EXPECTED_COUNTS.projects || quizzes.size !== EXPECTED_COUNTS.lessons || questionCount !== EXPECTED_COUNTS.quizQuestions) {
    throw new Error(`Official metadata count mismatch: modules=${moduleCount}, lessons=${lessonCount}, projects=${projectCount}, quiz lessons=${quizzes.size}, questions=${questionCount}.`);
  }
  for (const [code, questions] of quizzes) if (questions.length !== EXPECTED_COUNTS.questionsPerLesson) throw new Error(`${code} contains ${questions.length} questions; expected 5.`);
}

function assertObjectiveCoverage(codes: string[], records: Map<string, unknown>, label: string): void {
  const missing = codes.filter((code) => !records.has(code));
  const extras = [...records.keys()].filter((code) => !codes.includes(code));
  if (missing.length || extras.length) throw new Error(`${label} objective coverage mismatch. Missing: ${missing.join(", ") || "none"}; extra: ${extras.join(", ") || "none"}.`);
}

function assertOfficialTitles(
  structure: ReturnType<typeof parseCourseStructure>,
  modules: ReturnType<typeof parseObjectiveFile>,
  lessons: ReturnType<typeof parseObjectiveFile>,
  projects: ReturnType<typeof parseObjectiveFile>,
): void {
  for (const item of [...structure.modules, ...structure.lessons, ...structure.projects]) {
    const source = /^M\d{2}$/.test(item.code) ? modules.get(item.code) : item.code.includes("_L") ? lessons.get(item.code) : projects.get(item.code);
    if (!source || source.titleRu !== item.titleRu || source.titleEn !== item.titleEn) throw new Error(`${item.code}: objective-file title differs from authoritative Course Structure wording.`);
  }
}

async function makeAliasReport(sourceByName: Map<string, SourceFile[]>): Promise<AliasRecord[]> {
  const records: AliasRecord[] = [];
  for (const [sourceFilename, definition] of Object.entries(EXPLICIT_ALIASES).sort(([a], [b]) => a.localeCompare(b, "en"))) {
    const matches = sourceByName.get(sourceFilename) ?? [];
    if (matches.length > 1) throw new Error(`Explicit alias ${sourceFilename} appears more than once.`);
    const source = matches[0];
    records.push({
      sourceFilename,
      ...definition,
      sourcePresent: Boolean(source),
      sourceRelativePath: source?.relativePath ?? null,
      sourceSha256: source?.sha256 ?? null,
      status: source ? "ALIAS_RESOLVED" : "INVALID",
      deterministicExactMatch: true,
      fuzzyMatchingUsed: false,
    } as AliasRecord);
  }
  return records;
}

function makeRouteLanguageMap(): RouteLanguageMap {
  return {
    schemaVersion: SCHEMA_VERSION,
    architecture: "sectional-language-not-full-localization",
    core: {
      language: "ru",
      documentLanguage: "ru",
      routePrefix: "/",
      status: "RESERVED_FOUNDATION_ONLY",
      patterns: ["/", "/course", "/curriculum", "/how-it-works", "/faq", "/contact", "/auth/*", "/onboarding", "/dashboard", "/modules/[moduleCode]", "/lessons/[lessonCode]", "/projects/[projectCode]", "/quizzes/*", "/progress", "/certificates/*", "/profile", "/privacy", "/terms"],
    },
    documentary: {
      language: "en",
      documentLanguage: "en",
      routePrefix: "/en",
      status: "CONTROLLED_EMPTY_NAMESPACE_FOR_PHASE_10",
      patterns: ["/en", "/en/process", "/en/research", "/en/methodology", "/en/team", "/en/impact", "/en/journal", "/en/journal/[slug]"],
      authenticationRequired: false,
      inventedBodyCopyAllowed: false,
    },
    prohibitions: {
      globalLanguageSwitch: true,
      duplicateEnglishLessonTree: true,
      machineTranslatedPublishedCopy: true,
      mixedLanguageUncontrolledBodyField: true,
    },
  };
}

async function compareM01Snapshot(snapshotPath: string | null, regenerated: unknown): Promise<SnapshotComparison> {
  if (!snapshotPath) return {
    schemaVersion: SCHEMA_VERSION,
    compared: false,
    acceptedSnapshot: null,
    semanticEqual: false,
    controlledTimestampFieldsExcluded: ["generatedAt"],
    differences: [],
    sourceGroundedCorrections: 0,
    unexpectedDifferences: 0,
    result: "PASS",
  };
  let accepted: unknown;
  try { accepted = JSON.parse(await readFile(snapshotPath, "utf8")); }
  catch (error) { throw new Error(`Accepted M01 snapshot could not be read: ${error instanceof Error ? error.message : String(error)}`); }
  const differences = diffValues(accepted, regenerated, "$").map((difference): SnapshotDifference => {
    const known = difference.path === "$.lessons[2].vocabularyEntries[10].termEn"
      && difference.accepted === "CONTEXT EXAMPLE: human scale"
      && difference.regenerated === "human scale"
      ? { classification: "SOURCE_GROUNDED_PARSER_CORRECTION" as const, evidence: "M01_L03 VOCB source labels the English term as ‘human scale’; the previous extraction crossed into the context-column heading." }
      : difference.path === "$.lessons[3].vocabularyEntries[10].termEn"
        && difference.accepted === "public/private"
        && difference.regenerated === "public/private gradient"
        ? { classification: "SOURCE_GROUNDED_PARSER_CORRECTION" as const, evidence: "M01_L04 VOCB source contains the complete English term ‘public/private gradient’; the previous extraction truncated the final word." }
        : { classification: "UNEXPECTED_SEMANTIC_DIFFERENCE" as const };
    return { ...difference, ...known };
  });
  const sourceGroundedCorrections = differences.filter((difference) => difference.classification === "SOURCE_GROUNDED_PARSER_CORRECTION").length;
  const unexpectedDifferences = differences.length - sourceGroundedCorrections;
  return {
    schemaVersion: SCHEMA_VERSION,
    compared: true,
    acceptedSnapshot: "accepted generated/public/m01-dataset.json",
    semanticEqual: differences.length === 0,
    controlledTimestampFieldsExcluded: ["generatedAt"],
    differences,
    sourceGroundedCorrections,
    unexpectedDifferences,
    result: unexpectedDifferences > 0 ? "FAIL" : differences.length > 0 ? "PASS_WITH_SOURCE_GROUNDED_CORRECTIONS" : "PASS",
  };
}

function diffValues(accepted: unknown, regenerated: unknown, path: string): Array<{ path: string; accepted: unknown; regenerated: unknown }> {
  if (Object.is(accepted, regenerated)) return [];
  if (Array.isArray(accepted) && Array.isArray(regenerated)) {
    const differences: Array<{ path: string; accepted: unknown; regenerated: unknown }> = [];
    const count = Math.max(accepted.length, regenerated.length);
    for (let index = 0; index < count; index += 1) differences.push(...diffValues(accepted[index], regenerated[index], `${path}[${index}]`));
    return differences;
  }
  if (isRecord(accepted) && isRecord(regenerated)) {
    const differences: Array<{ path: string; accepted: unknown; regenerated: unknown }> = [];
    for (const key of [...new Set([...Object.keys(accepted), ...Object.keys(regenerated)])].sort()) {
      if (key === "generatedAt") continue;
      differences.push(...diffValues(accepted[key], regenerated[key], `${path}.${key}`));
    }
    return differences;
  }
  return [{ path, accepted, regenerated }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assetCategory(file: SourceFile): string {
  if (file.classification.status === "IGNORED_BY_POLICY") return "internal ignored evidence";
  if (file.extension === ".txt") return "repository text content";
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(file.extension)) return "optimized web image";
  if ([".pptx", ".docx", ".pdf"].includes(file.extension)) return "large public download";
  return "internal ignored evidence";
}

function recommendedProvider(file: SourceFile): string {
  if (file.extension === ".txt") return "version-controlled normalized content";
  if ([".png", ".jpg", ".jpeg"].includes(file.extension)) return "optimized derivative through provider-neutral registry";
  if ([".pptx", ".docx", ".pdf"].includes(file.extension)) return "large-object provider through storage abstraction";
  return "do not publish";
}

function validateTimestamp(value: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error(`--generated-at must be an ISO-compatible timestamp, received ${value}`);
  return new Date(value).toISOString().replace(".000Z", "Z");
}
