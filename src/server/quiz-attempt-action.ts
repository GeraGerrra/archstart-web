"use server";

import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createSecretSupabaseClient } from "@/src/lib/supabase/admin";
import type { QuizSubmissionInput, QuizSubmissionResult } from "@/src/quiz/types";
import { QuizAttemptValidationError, scoreQuizAttempt } from "./quiz-scoring.ts";

interface InsertedQuizAttempt {
  id: string;
  score: number;
  question_count: number;
  submitted_at: string;
}

function validInsertedAttempt(value: unknown): value is InsertedQuizAttempt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.score === "number"
    && typeof record.question_count === "number"
    && typeof record.submitted_at === "string";
}

export async function submitQuizAttemptAction(input: QuizSubmissionInput): Promise<QuizSubmissionResult> {
  const sessionClient = await createServerSupabaseClient();
  const { data: claimsResult, error: claimsError } = await sessionClient.auth.getClaims();
  const userId = typeof claimsResult?.claims?.sub === "string" ? claimsResult.claims.sub : "";

  if (claimsError || !userId) {
    return {
      status: "auth-required",
      message: "Войдите в аккаунт, чтобы проверить и сохранить попытку.",
    };
  }

  try {
    const scored = await scoreQuizAttempt(input);
    const secretClient = createSecretSupabaseClient();
    const { data, error } = await secretClient
      .from("quiz_attempts")
      .insert({
        user_id: userId,
        lesson_code: scored.lessonCode,
        selected_answers: scored.selectedAnswers,
        score: scored.score,
        question_count: scored.questionCount,
        answer_key_sha256: scored.answerKeySha256,
      })
      .select("id,score,question_count,submitted_at")
      .single();

    if (error || !validInsertedAttempt(data)) {
      return {
        status: "error",
        message: "Не удалось сохранить попытку. Попробуйте ещё раз.",
      };
    }

    return {
      status: "success",
      message: `Попытка сохранена. Результат: ${data.score} из ${data.question_count}.`,
      score: data.score,
      questionCount: data.question_count,
      attemptId: data.id,
      submittedAt: data.submitted_at,
    };
  } catch (error) {
    if (error instanceof QuizAttemptValidationError) {
      return {
        status: "invalid",
        message: "Проверьте выбранные ответы и отправьте попытку ещё раз.",
      };
    }
    return {
      status: "error",
      message: "Сохранение попытки временно недоступно.",
    };
  }
}
