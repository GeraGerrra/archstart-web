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

export interface QuizShellProps {
  model: QuizShellViewModel;
}
