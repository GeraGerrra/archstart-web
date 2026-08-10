import type { ReactNode } from "react";
import type { VisualStatus } from "@/src/design-system";

export interface LearningLink {
  label: string;
  href: string;
  ariaLabel?: string;
}

export interface LearningImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
}

export interface LearningOutcome {
  order: number;
  label: string;
  text: string;
}

export interface HomeHeroCopy {
  title: string;
  lead: string;
  audienceLabel: string;
  audience: string;
}

export interface HomeModuleCutout {
  code: string;
  titleRu: string;
  mobileTitle: string;
  href: string;
  image: LearningImage;
}

export interface HomeMetric {
  value: number;
  label: string;
}

export interface HomeModuleListItem {
  code: string;
  titleRu: string;
  titleEn: string;
  href: string;
}

export interface HomeOutputPreview {
  sectionTitle: string;
  title: string;
  description: string;
  action: LearningLink;
  image: LearningImage;
  imageButtonLabel: string;
}

export interface HomePageViewModel {
  hero: HomeHeroCopy;
  primaryAction: LearningLink;
  secondaryAction: LearningLink;
  cutoutStageLabel: string;
  cutouts: readonly HomeModuleCutout[];
  defaultCaption: string;
  metricsLabel: string;
  metrics: readonly HomeMetric[];
  moduleListTitle: string;
  moduleListAction: LearningLink;
  modules: readonly HomeModuleListItem[];
  output: HomeOutputPreview;
}

export interface CourseLessonDisplay {
  code: string;
  shortCode: string;
  titleRu: string;
  status: VisualStatus;
  action?: LearningLink;
  quietStatusLabel?: string;
}

export interface CourseProjectDisplay {
  code: string;
  titleRu: string;
  href?: string;
  status: VisualStatus;
  statusLabel?: string;
}

export interface CourseModuleCardDisplay {
  code: string;
  titleRu: string;
  titleEn: string;
  goal: string;
  href: string;
  status: VisualStatus;
  completedLessons: number;
  lessonTotal: number;
  cutout: LearningImage;
  lessons: readonly CourseLessonDisplay[];
  project?: CourseProjectDisplay;
}

export interface CourseProgressTotals {
  completedLessons: number;
  lessonTotal: number;
  completedModules: number;
  moduleTotal: number;
  completedProjects: number;
  projectTotal: number;
  quizQuestions: number;
}

export interface CourseOverviewViewModel {
  title: string;
  summary: string;
  demoDisclosure: string;
  continueAction: LearningLink;
  totals: CourseProgressTotals;
  moduleListTitle: string;
  modules: readonly CourseModuleCardDisplay[];
}

export interface DashboardContinueLearning {
  code: string;
  titleRu: string;
  titleEn: string;
  action: LearningLink;
}

export interface DashboardModuleMapItem {
  code: string;
  titleRu: string;
  titleEn: string;
  completedLessons: number;
  lessonTotal: number;
  progressLabel: string;
  action: LearningLink;
}

export interface DashboardEmptyHistory {
  title: string;
  description: string;
  records: readonly {
    label: string;
    value: string;
  }[];
}

export interface DashboardViewModel {
  title: string;
  disclosure: string;
  profileAction?: LearningLink;
  completedLessons: number;
  lessonTotal: number;
  continueLearning: DashboardContinueLearning;
  moduleMapTitle: string;
  modules: readonly DashboardModuleMapItem[];
  emptyHistory: DashboardEmptyHistory;
  projects?: readonly DashboardProjectItem[];
  staffReviewAction?: LearningLink;
}

export interface DashboardProjectItem {
  projectCode: string;
  titleRu: string;
  status: "none" | "draft" | "submitted" | "under_review" | "revisions_required" | "resubmitted" | "accepted" | "not_accepted";
  statusLabel: string;
  action: LearningLink;
}

export interface ModuleLessonItemDisplay {
  id: string;
  titleRu: string;
  titleEn: string;
  action?: LearningLink;
  pendingLabel?: string;
}

export interface ModuleLessonBranchDisplay {
  code: string;
  order: number;
  titleRu: string;
  titleEn: string;
  objective: string;
  status: VisualStatus;
  items: readonly ModuleLessonItemDisplay[];
}

export interface ModuleProjectRowDisplay {
  code: string;
  titleRu: string;
  titleEn: string;
  objective: string;
  status: VisualStatus;
  statusLabel?: string;
  action: LearningLink;
}

export interface ModuleFurtherStudyResource {
  id: string;
  title: string;
  provider: string;
  language: "RU" | "EN";
  level: "База" | "Углубление";
  description: string;
  url: `https://${string}`;
}

export interface ModuleFurtherStudyViewModel {
  kicker: "FURTHER STUDY";
  title: "Для углублённого изучения";
  description: string;
  resources: readonly [
    ModuleFurtherStudyResource,
    ModuleFurtherStudyResource,
    ModuleFurtherStudyResource,
  ];
}

export interface ModuleOverviewViewModel {
  code: string;
  titleRu: string;
  titleEn: string;
  goal: string;
  cutout: LearningImage;
  completedLessons: number;
  lessonTotal: number;
  outcomes: readonly LearningOutcome[];
  lessons: readonly ModuleLessonBranchDisplay[];
  project?: ModuleProjectRowDisplay;
  furtherStudy?: ModuleFurtherStudyViewModel;
}

export interface ModuleOverviewPageProps {
  model: ModuleOverviewViewModel;
  initialExpandedLessonCode?: string | null;
  completionContent?: ReactNode;
}

export interface ProjectOverviewViewModel {
  kicker: string;
  code: string;
  titleRu: string;
  titleEn: string;
  objective: string;
  assessedOutcomes: readonly LearningOutcome[];
  contentBlocks?: readonly ProjectContentBlock[];
  exampleBlockOrder?: number;
  exampleCaptionBlockOrder?: number;
  submissionNotice?: {
    title: string;
    description: string;
    buttonLabel: string;
  };
  backAction: LearningLink;
}

export interface ProjectContentBlock {
  order: number;
  type: "paragraph" | "table";
  style?: string;
  text?: string;
  rows?: readonly (readonly string[])[];
}

export interface ProjectOverviewPageProps {
  model: ProjectOverviewViewModel;
  exampleContent: ReactNode;
  workspaceContent?: ReactNode;
}
