export const PROJECT_CODES = [
  "M01_P01",
  "M02_P02",
  "M03_P03",
  "M04_P04",
  "M05_P05",
  "M06_P06",
  "M07_P07",
  "M08_P08",
] as const;

export type ProjectCode = (typeof PROJECT_CODES)[number];

export const PROJECT_SUBMISSION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "revisions_required",
  "resubmitted",
  "accepted",
  "not_accepted",
] as const;

export type ProjectSubmissionStatus =
  (typeof PROJECT_SUBMISSION_STATUSES)[number];

export interface ProjectPolicyProjection {
  projectCode: ProjectCode;
  formatType: "SINGLE_BOARD" | "MULTI_PAGE_PACK";
  allowedMimeTypes: readonly ("application/pdf" | "image/png")[];
  maxFileBytes: number;
  expectedWidth: number;
  expectedHeight: number;
  minPageCount: number;
  maxPageCount: number;
  supportingTextMinWords: number;
  supportingTextMaxWords: number;
}

export interface ProjectVersionProjection {
  id: string;
  number: number;
  state: "draft" | "submitted";
  learnerNote: string;
  supportingText: string;
  submittedAt: string | null;
}

export interface ProjectFileProjection {
  id: string;
  originalFilename: string;
  declaredMime: "application/pdf" | "image/png";
  sizeBytes: number;
}

export interface ProjectReviewCriterionProjection {
  number: number;
  title: string;
  description: string;
  maxPoints: number;
  awardedPoints: number | null;
  comment: string | null;
}

export interface ProjectReviewProjection {
  decision: "revisions_required" | "accepted" | "not_accepted";
  summary: string;
  score: number;
  reviewedAt: string;
  criteria: readonly ProjectReviewCriterionProjection[];
}

export type LearnerProjectWorkspaceProjection =
  | {
      kind: "anonymous";
      signInHref: string;
    }
  | {
      kind: "onboarding-required";
      onboardingHref: "/onboarding";
    }
  | {
      kind: "learner";
      moduleCode: string;
      projectCode: ProjectCode;
      status: "none" | ProjectSubmissionStatus;
      submissionId: string | null;
      completedLessons: number;
      requiredLessons: 5;
      policy: ProjectPolicyProjection;
      editableVersion: ProjectVersionProjection | null;
      currentVersion: ProjectVersionProjection | null;
      activeFile: ProjectFileProjection | null;
      currentFile: ProjectFileProjection | null;
      review: ProjectReviewProjection | null;
    };

export interface StaffReviewerProjection {
  id: string;
  displayName: string;
}

export interface StaffAssignmentQueueItem {
  submissionId: string;
  projectCode: ProjectCode;
  learnerDisplayName: string;
  versionNumber: number;
  status: Extract<ProjectSubmissionStatus, "submitted" | "resubmitted">;
  submittedAt: string;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
}

export interface StaffReviewAssignmentProjection {
  submissionId: string;
  projectCode: ProjectCode;
  learnerDisplayName: string;
  versionId: string;
  versionNumber: number;
  status: Extract<ProjectSubmissionStatus, "submitted" | "resubmitted" | "under_review">;
  submittedAt: string;
  learnerNote: string | null;
  supportingText: string | null;
  file: ProjectFileProjection;
  criteria: readonly ProjectReviewCriterionProjection[];
}

export type StaffProjectWorkspaceProjection =
  | { kind: "denied" }
  | {
      kind: "staff";
      role: "reviewer" | "admin";
      reviewers: readonly StaffReviewerProjection[];
      assignmentQueue: readonly StaffAssignmentQueueItem[];
      assignments: readonly StaffReviewAssignmentProjection[];
    };

export type ProjectWorkspaceMutationResult =
  | {
      status: "success";
      message: string;
    }
  | {
      status: "auth-required" | "invalid" | "denied" | "error";
      message: string;
    };
