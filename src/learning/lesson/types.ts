import type { ReactNode } from "react";
import type { VisualStatus } from "@/src/design-system";

export type CourseTreeItemState = "current" | "completed" | "future";

export interface CourseTreeItemDisplay {
  id: string;
  title: string;
  href: string;
  state: CourseTreeItemState;
}

export interface CourseTreeLessonDisplay {
  code: string;
  shortCode: string;
  titleRu: string;
  href: string;
  status: VisualStatus;
  open: boolean;
  items: readonly CourseTreeItemDisplay[];
}

export interface CourseTreeViewModel {
  ariaLabel: string;
  module: {
    code: string;
    titleRu: string;
    titleEn: string;
  };
  lessons: readonly CourseTreeLessonDisplay[];
  project: {
    code: string;
    titleRu: string;
    href: string;
  };
}

export interface LessonHeaderViewModel {
  breadcrumbs: {
    course: { label: string; href: string };
    module: { label: string; href: string };
    lesson: { label: string; href: string };
    activeItemLabel: string;
  };
  lessonDisplayCode: string;
  activeItemTitleRu: string;
  activeItemTitleEn: string;
  lessonTitleRu: string;
  lessonTitleEn: string;
}

export interface LessonPagerAction {
  contextLabel: string;
  displayLabel: string;
  href: string;
}

export interface LessonPagerViewModel {
  previous?: LessonPagerAction;
  next: LessonPagerAction;
}

export interface LessonWorkspaceContentsViewModel {
  triggerIcon: string;
  triggerLabel: string;
  triggerSummary: string;
  drawerEyebrow: string;
  drawerTitle: string;
  drawerAriaLabel: string;
  drawerCloseLabel: string;
}

export interface LessonWorkspaceViewModel {
  courseTree: CourseTreeViewModel;
  header: LessonHeaderViewModel;
  pager: LessonPagerViewModel;
  contents: LessonWorkspaceContentsViewModel;
}

export interface LessonWorkspaceProps {
  model: LessonWorkspaceViewModel;
  activeItemContent: ReactNode;
  completionContent?: ReactNode;
  initialContentsOpen?: boolean;
}
