export const COMPLETION_DEMO_STATES = ["locked", "ready", "complete"] as const;

export type CompletionKind = "lesson" | "module";
export type CompletionDemoState = (typeof COMPLETION_DEMO_STATES)[number];
export type CompletionMutationStatus = "success" | "auth-required" | "invalid" | "error";

export interface CompletionCutoutViewModel {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface CompletionNextAction {
  href: string;
  label: string;
}

export interface CutoutCompletionViewModel {
  kind: CompletionKind;
  segmentCode: string;
  cutout: CompletionCutoutViewModel;
  initialState: CompletionDemoState;
  lockedTitle: string;
  lockedMessage: string;
  lockedLabel: string;
  beforeTitle: string;
  beforeMessage: string;
  completedTitle: string;
  completedMessage: string;
  actionLabel: string;
  undoLabel: string;
  nextAction?: CompletionNextAction;
}

export interface CompletionMutationResult {
  status: CompletionMutationStatus;
  state: CompletionDemoState;
  message: string;
}

export type CompletionMutationAction = () => Promise<CompletionMutationResult>;

export interface CutoutCompletionButtonProps {
  model: CutoutCompletionViewModel;
  completeAction?: CompletionMutationAction;
  undoAction?: CompletionMutationAction;
}
