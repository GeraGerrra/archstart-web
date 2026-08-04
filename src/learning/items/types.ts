import type { ReactNode } from "react";
import type { LearningLink, LearningOutcome } from "../types";

export interface OverviewRouteEntry {
  order: number;
  titleRu: string;
  titleEn: string;
  summary: string;
  action: LearningLink;
}

export interface OverviewItemViewModel {
  lessonTitleRu: string;
  lessonTitleEn: string;
  objective: string;
  duration: { label: string; value: string };
  itemCount: { label: string; value: number };
  outcomeCount: { label: string; value: number };
  startAction: LearningLink;
  outcomes: readonly LearningOutcome[];
  route: readonly OverviewRouteEntry[];
}

export interface PracticeStep {
  order: number;
  text: string;
}

export interface PracticeItemViewModel {
  titleRu: string;
  titleEn: string;
  purpose: string;
  status: string;
  estimatedTime: string;
  toolsHeading: string;
  tools: readonly string[];
  studentTask: string;
  orderedSteps: readonly PracticeStep[];
  selfCheck: readonly string[];
}

export interface PracticeItemProps {
  model: PracticeItemViewModel;
  exampleContent?: ReactNode;
}

export interface ResourcesItemViewModel {
  title: string;
}
