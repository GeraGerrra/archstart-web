import "server-only";

import { signInDestination } from "@/src/auth/redirects";
import { createSecretSupabaseClient } from "@/src/lib/supabase/admin";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import {
  PROJECT_FILE_LIMITS,
  PROJECT_UUID_PATTERN,
  isProjectSubmissionStatus,
  moduleCodeForProject,
  normalizeProjectCode,
  projectCodeForModule,
} from "@/src/project-workspace/policy";
import type {
  LearnerProjectWorkspaceProjection,
  ProjectCode,
  ProjectFileProjection,
  ProjectPolicyProjection,
  ProjectReviewCriterionProjection,
  ProjectReviewProjection,
  ProjectSubmissionStatus,
  ProjectVersionProjection,
  StaffProjectWorkspaceProjection,
} from "@/src/project-workspace/types";

type SessionClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(record).filter((row): row is Record<string, unknown> => Boolean(row))
    : [];
}

function uuid(value: unknown): string | null {
  return typeof value === "string" && PROJECT_UUID_PATTERN.test(value)
    ? value
    : null;
}

function safeInteger(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum
    ? value
    : null;
}

function safeDate(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : null;
}

function text(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.length <= maximum ? value : null;
}

function parsePolicy(value: unknown, projectCode: ProjectCode): ProjectPolicyProjection | null {
  const row = record(value);
  if (!row || normalizeProjectCode(row.project_code) !== projectCode) return null;
  const formatType = row.format_type;
  const allowedMimeTypes = row.allowed_mime_types;
  if (
    (formatType !== "SINGLE_BOARD" && formatType !== "MULTI_PAGE_PACK")
    || !Array.isArray(allowedMimeTypes)
    || allowedMimeTypes.length < 1
    || allowedMimeTypes.length > 2
    || !allowedMimeTypes.every((mime) => mime === "application/pdf" || mime === "image/png")
  ) return null;

  const maxFileBytes = safeInteger(row.max_file_bytes, 1, PROJECT_FILE_LIMITS.absoluteMaximumBytes);
  const expectedWidth = safeInteger(row.expected_width, 1, 100_000);
  const expectedHeight = safeInteger(row.expected_height, 1, 100_000);
  const minPageCount = safeInteger(row.min_page_count, 1, 1_000);
  const maxPageCount = safeInteger(row.max_page_count, 1, 1_000);
  const supportingTextMinWords = safeInteger(row.supporting_text_min_words, 0, 8_000);
  const supportingTextMaxWords = safeInteger(row.supporting_text_max_words, 0, 8_000);
  if (
    maxFileBytes === null
    || expectedWidth === null
    || expectedHeight === null
    || minPageCount === null
    || maxPageCount === null
    || supportingTextMinWords === null
    || supportingTextMaxWords === null
  ) return null;

  return {
    projectCode,
    formatType,
    allowedMimeTypes: [...allowedMimeTypes],
    maxFileBytes,
    expectedWidth,
    expectedHeight,
    minPageCount,
    maxPageCount,
    supportingTextMinWords,
    supportingTextMaxWords,
  };
}

function parseVersion(value: unknown): ProjectVersionProjection | null {
  const row = record(value);
  if (!row) return null;
  const id = uuid(row.id);
  const number = safeInteger(row.version_number, 1, 32_767);
  const state = row.version_state;
  const learnerNote = row.learner_note === null ? "" : text(row.learner_note, 2_000);
  const supportingText = row.supporting_text === null ? "" : text(row.supporting_text, 8_000);
  const submittedAt = row.submitted_at === null ? null : safeDate(row.submitted_at);
  if (
    !id
    || number === null
    || (state !== "draft" && state !== "submitted")
    || learnerNote === null
    || supportingText === null
    || (row.submitted_at !== null && submittedAt === null)
  ) return null;
  return { id, number, state, learnerNote, supportingText, submittedAt };
}

function parseFile(value: unknown): ProjectFileProjection | null {
  const row = record(value);
  if (!row) return null;
  const id = uuid(row.id);
  const originalFilename = text(row.original_filename, 255);
  const declaredMime = row.declared_mime;
  const sizeBytes = safeInteger(row.size_bytes, 1, PROJECT_FILE_LIMITS.absoluteMaximumBytes);
  if (
    !id
    || !originalFilename
    || (declaredMime !== "application/pdf" && declaredMime !== "image/png")
    || sizeBytes === null
  ) return null;
  return { id, originalFilename, declaredMime, sizeBytes };
}

function parseReviewCriterion(
  value: unknown,
  includeAward: boolean,
): ProjectReviewCriterionProjection | null {
  const row = record(value);
  if (!row) return null;
  const number = safeInteger(row.criterion_number, 1, 5);
  const title = text(
    row.criterion_title_snapshot ?? row.title,
    300,
  );
  const description = text(
    row.criterion_description_snapshot ?? row.description,
    2_000,
  );
  const maxPoints = safeInteger(row.max_points, 1, 100);
  const awardedPoints = includeAward
    ? safeInteger(row.awarded_points, 0, 100)
    : null;
  const comment = includeAward
    ? row.comment === null
      ? null
      : text(row.comment, 2_000)
    : null;
  if (
    number === null
    || !title
    || !description
    || maxPoints === null
    || (includeAward && awardedPoints === null)
    || (includeAward && row.comment !== null && comment === null)
  ) return null;
  return { number, title, description, maxPoints, awardedPoints, comment };
}

function exactFiveCriteria(
  value: unknown,
  includeAward: boolean,
): ProjectReviewCriterionProjection[] {
  const parsed = rows(value)
    .map((row) => parseReviewCriterion(row, includeAward))
    .filter((criterion): criterion is ProjectReviewCriterionProjection => Boolean(criterion))
    .sort((left, right) => left.number - right.number);
  return parsed.length === 5
    && parsed.every((criterion, index) => criterion.number === index + 1)
    ? parsed
    : [];
}

async function authenticatedSession(): Promise<{
  client: SessionClient;
  userId: string;
} | null> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
  return !error && PROJECT_UUID_PATTERN.test(userId) ? { client, userId } : null;
}

async function activePolicy(projectCode: ProjectCode): Promise<ProjectPolicyProjection> {
  const secretClient = createSecretSupabaseClient();
  const { data, error } = await secretClient.rpc(
    "get_project_submission_policy_for_service",
    { p_project_code: projectCode },
  );
  const policyRows = rows(data);
  const policy = policyRows.length === 1
    ? parsePolicy(policyRows[0], projectCode)
    : null;
  if (error || !policy) throw new Error("Active project policy is unavailable.");
  return policy;
}

export async function loadLearnerProjectWorkspaceProjection(
  moduleCodeValue: string,
  returnPath: string,
): Promise<LearnerProjectWorkspaceProjection> {
  const projectCode = projectCodeForModule(moduleCodeValue);
  if (!projectCode) throw new Error("Unsupported project module.");
  const moduleCode = moduleCodeForProject(projectCode);
  const session = await authenticatedSession();
  if (!session) return { kind: "anonymous", signInHref: signInDestination(returnPath) };

  const { data: profile, error: profileError } = await session.client
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("user_id", session.userId)
    .maybeSingle();
  if (profileError) throw new Error("Learner profile is unavailable.");
  if (!profile?.onboarding_completed_at) {
    return { kind: "onboarding-required", onboardingHref: "/onboarding" };
  }

  const [policy, submissionResult, completionResult] = await Promise.all([
    activePolicy(projectCode),
    session.client
      .from("project_submissions")
      .select("id,current_version_id,current_status")
      .eq("project_code", projectCode)
      .maybeSingle(),
    session.client
      .from("lesson_completions")
      .select("lesson_code")
      .eq("user_id", session.userId)
      .like("lesson_code", `${moduleCode}_L%`),
  ]);
  if (submissionResult.error || completionResult.error) {
    throw new Error("Learner project workspace is unavailable.");
  }
  const completedLessons = new Set(
    rows(completionResult.data)
      .map((row) => row.lesson_code)
      .filter((code): code is string =>
        typeof code === "string" && new RegExp(`^${moduleCode}_L0[1-5]$`, "u").test(code)),
  ).size;

  if (!submissionResult.data) {
    return {
      kind: "learner",
      moduleCode,
      projectCode,
      status: "none",
      submissionId: null,
      completedLessons,
      requiredLessons: 5,
      policy,
      editableVersion: null,
      currentVersion: null,
      activeFile: null,
      currentFile: null,
      review: null,
    };
  }

  const submission = record(submissionResult.data);
  const submissionId = uuid(submission?.id);
  const currentVersionId = uuid(submission?.current_version_id);
  const status = submission?.current_status;
  if (!submissionId || !currentVersionId || !isProjectSubmissionStatus(status)) {
    throw new Error("Learner project state is invalid.");
  }

  const versionsResult = await session.client
    .from("project_submission_versions")
    .select("id,version_number,version_state,learner_note,supporting_text,submitted_at")
    .eq("submission_id", submissionId)
    .order("version_number", { ascending: false });
  if (versionsResult.error) throw new Error("Learner project versions are unavailable.");
  const versions = rows(versionsResult.data)
    .map(parseVersion)
    .filter((version): version is ProjectVersionProjection => Boolean(version));
  const currentVersion = versions.find((version) => version.id === currentVersionId) ?? null;
  const editableVersion = versions.find((version) => version.state === "draft") ?? null;
  if (!currentVersion) throw new Error("Current learner project version is unavailable.");

  const versionIds = [...new Set(
    [currentVersion.id, editableVersion?.id].filter((id): id is string => Boolean(id)),
  )];
  const [filesResult, reviewResult] = await Promise.all([
    session.client
      .from("project_submission_files")
      .select("id,version_id,original_filename,declared_mime,size_bytes")
      .in("version_id", versionIds),
    session.client
      .from("project_reviews")
      .select("id,version_id,decision,summary,score,reviewed_at")
      .eq("version_id", currentVersion.id)
      .maybeSingle(),
  ]);
  if (filesResult.error || reviewResult.error) {
    throw new Error("Learner project file or review is unavailable.");
  }
  const files = rows(filesResult.data)
    .map((row) => ({ versionId: uuid(row.version_id), file: parseFile(row) }))
    .filter((entry): entry is { versionId: string; file: ProjectFileProjection } =>
      Boolean(entry.versionId && entry.file));
  const activeVersionId = editableVersion?.id ?? currentVersion.id;
  const activeFile = files.find((entry) => entry.versionId === activeVersionId)?.file ?? null;
  const currentFile = files.find((entry) => entry.versionId === currentVersion.id)?.file ?? null;

  let review: ProjectReviewProjection | null = null;
  const reviewRow = record(reviewResult.data);
  if (reviewRow) {
    const reviewId = uuid(reviewRow.id);
    const decision = reviewRow.decision;
    const summary = text(reviewRow.summary, 5_000);
    const score = safeInteger(reviewRow.score, 0, 100);
    const reviewedAt = safeDate(reviewRow.reviewed_at);
    if (
      reviewId
      && (decision === "revisions_required" || decision === "accepted" || decision === "not_accepted")
      && summary
      && score !== null
      && reviewedAt
    ) {
      const criteriaResult = await session.client
        .from("project_review_criteria")
        .select("criterion_number,criterion_title_snapshot,criterion_description_snapshot,max_points,awarded_points,comment")
        .eq("review_id", reviewId)
        .order("criterion_number", { ascending: true });
      if (criteriaResult.error) throw new Error("Learner review criteria are unavailable.");
      const criteria = exactFiveCriteria(criteriaResult.data, true);
      if (criteria.length === 5) {
        review = { decision, summary, score, reviewedAt, criteria };
      }
    }
  }

  return {
    kind: "learner",
    moduleCode,
    projectCode,
    status: status as ProjectSubmissionStatus,
    submissionId,
    completedLessons,
    requiredLessons: 5,
    policy,
    editableVersion,
    currentVersion,
    activeFile,
    currentFile,
    review,
  };
}

function displayName(
  profile: Record<string, unknown> | undefined,
  fallback: string,
): string {
  const first = typeof profile?.first_name === "string" ? profile.first_name.trim() : "";
  const last = typeof profile?.last_name === "string" ? profile.last_name.trim() : "";
  return [first, last].filter(Boolean).join(" ") || fallback;
}

export async function loadStaffProjectWorkspaceProjection(): Promise<StaffProjectWorkspaceProjection> {
  const session = await authenticatedSession();
  if (!session) return { kind: "denied" };
  const secretClient = createSecretSupabaseClient();
  const { data: ownRoleData, error: ownRoleError } = await secretClient.rpc(
    "get_project_staff_roles_for_service",
    { p_user_id: session.userId },
  );
  if (ownRoleError) throw new Error("Staff authorization is unavailable.");
  const ownRoles = new Set(rows(ownRoleData).map((row) => row.staff_role));
  const role = ownRoles.has("admin") ? "admin" : ownRoles.has("reviewer") ? "reviewer" : null;
  if (!role) return { kind: "denied" };

  const [activeRoleResult, queueResult, ownAssignmentResult] = await Promise.all([
    role === "admin"
      ? secretClient.rpc("list_active_project_staff_for_service")
      : Promise.resolve({ data: [], error: null }),
    role === "admin"
      ? secretClient.from("project_submissions")
        .select("id,user_id,project_code,current_version_id,current_status")
        .in("current_status", ["submitted", "resubmitted"])
        .order("submitted_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    secretClient.rpc("list_active_project_reviewer_assignments_for_service"),
  ]);
  if (activeRoleResult.error || queueResult.error || ownAssignmentResult.error) {
    throw new Error("Staff project lists are unavailable.");
  }

  const queueRows = rows(queueResult.data);
  const activeAssignmentRows = rows(ownAssignmentResult.data);
  const ownAssignmentRows = activeAssignmentRows.filter(
    (row) => uuid(row.reviewer_id) === session.userId,
  );
  const ownSubmissionIds = ownAssignmentRows
    .map((row) => uuid(row.submission_id))
    .filter((id): id is string => Boolean(id));
  const ownSubmissionResult = ownSubmissionIds.length
    ? await secretClient.from("project_submissions")
      .select("id,user_id,project_code,current_version_id,current_status")
      .in("id", ownSubmissionIds)
      .in("current_status", ["submitted", "resubmitted", "under_review"])
    : { data: [], error: null };
  if (ownSubmissionResult.error) throw new Error("Assigned projects are unavailable.");
  const ownSubmissionRows = rows(ownSubmissionResult.data);
  const allSubmissionRows = [...queueRows, ...ownSubmissionRows];
  const versionIds = [...new Set(allSubmissionRows
    .map((row) => uuid(row.current_version_id))
    .filter((id): id is string => Boolean(id)))];
  const assignedVersionIds = [...new Set(ownSubmissionRows
    .map((row) => uuid(row.current_version_id))
    .filter((id): id is string => Boolean(id)))];
  const learnerIds = [...new Set(allSubmissionRows
    .map((row) => uuid(row.user_id))
    .filter((id): id is string => Boolean(id)))];
  const activeStaffIds = [...new Set(rows(activeRoleResult.data)
    .map((row) => uuid(row.user_id))
    .filter((id): id is string => Boolean(id)))];
  const profileIds = [...new Set([...learnerIds, ...activeStaffIds])];

  const [
    versionsResult,
    assignedVersionTextResult,
    filesResult,
    profilesResult,
    activeAssignmentsResult,
  ] = await Promise.all([
    versionIds.length
      ? secretClient.from("project_submission_versions")
        .select("id,project_code,version_number,rubric_version,submitted_at")
        .in("id", versionIds)
      : Promise.resolve({ data: [], error: null }),
    assignedVersionIds.length
      ? secretClient.from("project_submission_versions")
        .select("id,learner_note,supporting_text")
        .in("id", assignedVersionIds)
      : Promise.resolve({ data: [], error: null }),
    versionIds.length
      ? secretClient.from("project_submission_files")
        .select("id,version_id,original_filename,declared_mime,size_bytes")
        .in("version_id", versionIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? secretClient.from("profiles")
        .select("user_id,first_name,last_name")
        .in("user_id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    queueRows.length
      ? Promise.resolve({
          data: activeAssignmentRows.filter((assignment) =>
            queueRows.some((submission) => submission.id === assignment.submission_id)),
          error: null,
        })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (
    versionsResult.error
    || assignedVersionTextResult.error
    || filesResult.error
    || profilesResult.error
    || activeAssignmentsResult.error
  ) {
    throw new Error("Staff project details are unavailable.");
  }
  const versionRows = rows(versionsResult.data);
  const versionById = new Map(versionRows
    .map((row) => [uuid(row.id), row] as const)
    .filter((entry): entry is readonly [string, Record<string, unknown>] => Boolean(entry[0])));
  const assignedVersionTextById = new Map(rows(assignedVersionTextResult.data)
    .map((row) => [uuid(row.id), row] as const)
    .filter((entry): entry is readonly [string, Record<string, unknown>] => Boolean(entry[0])));
  const fileByVersionId = new Map(rows(filesResult.data)
    .map((row) => [uuid(row.version_id), parseFile(row)] as const)
    .filter((entry): entry is readonly [string, ProjectFileProjection] => Boolean(entry[0] && entry[1])));
  const profileById = new Map(rows(profilesResult.data)
    .map((row) => [uuid(row.user_id), row] as const)
    .filter((entry): entry is readonly [string, Record<string, unknown>] => Boolean(entry[0])));
  const activeReviewerBySubmission = new Map(rows(activeAssignmentsResult.data)
    .map((row) => [uuid(row.submission_id), uuid(row.reviewer_id)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[0] && entry[1])));

  const reviewerIds = [...new Set(activeStaffIds)];
  const reviewers = role === "admin"
    ? reviewerIds.map((id) => ({
        id,
        displayName: displayName(profileById.get(id), "Сотрудник ARCH.START"),
      })).sort((left, right) => left.displayName.localeCompare(right.displayName, "ru"))
    : [];

  const assignmentQueue = role === "admin" ? queueRows.flatMap((submission) => {
    const submissionId = uuid(submission.id);
    const learnerId = uuid(submission.user_id);
    const projectCode = normalizeProjectCode(submission.project_code);
    const versionId = uuid(submission.current_version_id);
    const status = submission.current_status;
    const version = versionId ? versionById.get(versionId) : undefined;
    const versionNumber = safeInteger(version?.version_number, 1, 32_767);
    const submittedAt = safeDate(version?.submitted_at);
    if (
      !submissionId
      || !learnerId
      || !projectCode
      || (status !== "submitted" && status !== "resubmitted")
      || versionNumber === null
      || !submittedAt
    ) return [];
    const normalizedStatus: "submitted" | "resubmitted" = status;
    const assignedReviewerId = activeReviewerBySubmission.get(submissionId) ?? null;
    return [{
      submissionId,
      projectCode,
      learnerDisplayName: displayName(profileById.get(learnerId), "Участник ARCH.START"),
      versionNumber,
      status: normalizedStatus,
      submittedAt,
      assignedReviewerId,
      assignedReviewerName: assignedReviewerId
        ? displayName(profileById.get(assignedReviewerId), "Сотрудник ARCH.START")
        : null,
    }];
  }) : [];

  const rubricPairs = ownSubmissionRows.flatMap((submission) => {
    const versionId = uuid(submission.current_version_id);
    const version = versionId ? versionById.get(versionId) : undefined;
    const projectCode = normalizeProjectCode(version?.project_code);
    const rubricVersion = safeInteger(version?.rubric_version, 1, 32_767);
    return projectCode && rubricVersion !== null ? [{ projectCode, rubricVersion }] : [];
  });
  const rubricProjectCodes = [...new Set(rubricPairs.map((pair) => pair.projectCode))];
  const rubricResult = rubricProjectCodes.length
    ? await secretClient.rpc("list_project_rubric_criteria_for_service", {
      p_project_codes: rubricProjectCodes,
    })
    : { data: [], error: null };
  if (rubricResult.error) throw new Error("Project rubric is unavailable.");
  const rubricRows = rows(rubricResult.data);

  const assignments = ownSubmissionRows.flatMap((submission) => {
    const submissionId = uuid(submission.id);
    const learnerId = uuid(submission.user_id);
    const projectCode = normalizeProjectCode(submission.project_code);
    const versionId = uuid(submission.current_version_id);
    const status = submission.current_status;
    const version = versionId ? versionById.get(versionId) : undefined;
    const versionText = versionId ? assignedVersionTextById.get(versionId) : undefined;
    const versionNumber = safeInteger(version?.version_number, 1, 32_767);
    const rubricVersion = safeInteger(version?.rubric_version, 1, 32_767);
    const submittedAt = safeDate(version?.submitted_at);
    const learnerNote = versionText?.learner_note === null
      ? null
      : text(versionText?.learner_note, PROJECT_FILE_LIMITS.noteMaximumCharacters);
    const supportingText = versionText?.supporting_text === null
      ? null
      : text(versionText?.supporting_text, PROJECT_FILE_LIMITS.supportingTextMaximumCharacters);
    const file = versionId ? fileByVersionId.get(versionId) : undefined;
    if (
      !submissionId
      || !learnerId
      || !projectCode
      || !versionId
      || (status !== "submitted" && status !== "resubmitted" && status !== "under_review")
      || versionNumber === null
      || rubricVersion === null
      || !submittedAt
      || (learnerNote === null && versionText?.learner_note !== null)
      || (supportingText === null && versionText?.supporting_text !== null)
      || !file
    ) return [];
    const normalizedStatus: "submitted" | "resubmitted" | "under_review" = status;
    const criteria = exactFiveCriteria(
      rubricRows.filter((row) =>
        normalizeProjectCode(row.project_code) === projectCode
        && row.rubric_version === rubricVersion),
      false,
    );
    if (criteria.length !== 5) return [];
    return [{
      submissionId,
      projectCode,
      learnerDisplayName: displayName(profileById.get(learnerId), "Участник ARCH.START"),
      versionId,
      versionNumber,
      status: normalizedStatus,
      submittedAt,
      learnerNote,
      supportingText: projectCode === "M02_P02" ? supportingText : null,
      file,
      criteria,
    }];
  });

  return { kind: "staff", role, reviewers, assignmentQueue, assignments };
}
