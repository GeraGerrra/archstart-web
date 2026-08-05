import "server-only";

import type { LessonCode } from "../content-engine/types.ts";
import { loadQuizAnswerAuthority } from "./quiz-answer-key-loader.ts";
import { loadPublicQuiz, parseQuizLessonCode } from "./public-quiz-loader.ts";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;

export class QuizAttemptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizAttemptValidationError";
  }
}

export interface QuizAttemptScoringInput {
  lessonCode: unknown;
  selectedAnswers: unknown;
}

export interface ScoredQuizAttempt {
  lessonCode: LessonCode;
  selectedAnswers: Readonly<Record<string, string>>;
  score: number;
  questionCount: 5;
  quizVersion: string;
  answerKeySha256: string;
}

function selectedAnswerRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QuizAttemptValidationError("selectedAnswers must be an object.");
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length !== 5) {
    throw new QuizAttemptValidationError("selectedAnswers must contain exactly five entries.");
  }

  for (const [questionId, optionId] of entries) {
    if (!IDENTIFIER_PATTERN.test(questionId)) {
      throw new QuizAttemptValidationError("selectedAnswers contains an invalid question identifier.");
    }
    if (typeof optionId !== "string" || !IDENTIFIER_PATTERN.test(optionId)) {
      throw new QuizAttemptValidationError("selectedAnswers contains an invalid option identifier.");
    }
  }

  return Object.fromEntries(entries) as Record<string, string>;
}

export async function scoreQuizAttempt(input: QuizAttemptScoringInput): Promise<Readonly<ScoredQuizAttempt>> {
  const lessonCode = parseQuizLessonCode(input.lessonCode);
  const submitted = selectedAnswerRecord(input.selectedAnswers);
  const [publicQuiz, authority] = await Promise.all([
    loadPublicQuiz(lessonCode),
    loadQuizAnswerAuthority(lessonCode),
  ]);

  if (publicQuiz.quizVersion !== authority.answerSet.quizVersion) {
    throw new QuizAttemptValidationError("Public Quiz and answer authority versions do not match.");
  }
  if (publicQuiz.questions.length !== 5 || authority.answerSet.answers.length !== 5) {
    throw new QuizAttemptValidationError("Quiz authority must contain exactly five questions.");
  }

  const answerByQuestion = new Map(
    authority.answerSet.answers.map((answer) => [answer.questionId, answer] as const),
  );
  if (answerByQuestion.size !== 5) {
    throw new QuizAttemptValidationError("Quiz answer authority contains duplicate question identifiers.");
  }

  const expectedQuestionIds = new Set(publicQuiz.questions.map((question) => question.id));
  const submittedQuestionIds = Object.keys(submitted);
  if (
    submittedQuestionIds.some((questionId) => !expectedQuestionIds.has(questionId))
    || publicQuiz.questions.some((question) => !(question.id in submitted))
  ) {
    throw new QuizAttemptValidationError("Submitted question identifiers do not match the public Quiz.");
  }

  let score = 0;
  const canonicalEntries: Array<readonly [string, string]> = [];

  for (const question of publicQuiz.questions) {
    const selectedOptionId = submitted[question.id];
    const validOptionIds = new Set(question.options.map((option) => option.id));
    const answer = answerByQuestion.get(question.id);

    if (!selectedOptionId || !validOptionIds.has(selectedOptionId)) {
      throw new QuizAttemptValidationError("A selected option does not belong to its public question.");
    }
    if (!answer || !validOptionIds.has(answer.correctOptionId)) {
      throw new QuizAttemptValidationError("Server answer authority does not match the public Quiz.");
    }

    canonicalEntries.push([question.id, selectedOptionId]);
    if (selectedOptionId === answer.correctOptionId) score += 1;
  }

  return {
    lessonCode,
    selectedAnswers: Object.fromEntries(canonicalEntries),
    score,
    questionCount: 5,
    quizVersion: publicQuiz.quizVersion,
    answerKeySha256: authority.answerKeySha256,
  };
}
