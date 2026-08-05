export interface QuizOptionViewModel {
  id: string;
  order: number;
  displayLabel: string;
  text: string;
}

export interface QuizQuestionViewModel {
  id: string;
  order: number;
  displayOrder: string;
  text: string;
  options: readonly QuizOptionViewModel[];
}

export interface QuizShellLabels {
  title: string;
  instructions: string;
  selectedCountSuffix: string;
  preSubmitMessage: string;
  submittedMessage: string;
  submitButton: string;
}

export interface QuizShellViewModel {
  questions: readonly QuizQuestionViewModel[];
  labels: QuizShellLabels;
}

export interface QuizSubmissionInput {
  lessonCode: string;
  selectedAnswers: Record<string, string>;
}

export type QuizSubmissionStatus = "success" | "auth-required" | "invalid" | "error";

export interface QuizSubmissionResult {
  status: QuizSubmissionStatus;
  message: string;
  score?: number;
  questionCount?: number;
  attemptId?: string;
  submittedAt?: string;
}

export type QuizSubmissionAction = (input: QuizSubmissionInput) => Promise<QuizSubmissionResult>;

export interface QuizShellProps {
  model: QuizShellViewModel;
  lessonCode?: string;
  submitAction?: QuizSubmissionAction;
}
