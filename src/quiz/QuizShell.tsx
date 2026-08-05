"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { Button } from "@/src/design-system";
import type { QuizShellProps, QuizSubmissionResult } from "./types";

const FALLBACK_SUBMISSION_ERROR: QuizSubmissionResult = {
  status: "error",
  message: "Не удалось отправить попытку. Попробуйте ещё раз.",
};

export function QuizShell({ model, lessonCode, submitAction }: QuizShellProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<QuizSubmissionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedCount = Object.keys(selectedOptions).length;
  const persistentSubmission = Boolean(lessonCode && submitAction);

  function submitSelections(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!persistentSubmission || !lessonCode || !submitAction) {
      setSubmitted(true);
      return;
    }

    startTransition(async () => {
      try {
        const result = await submitAction({
          lessonCode,
          selectedAnswers: { ...selectedOptions },
        });
        setSubmissionResult(result);
        setSubmitted(result.status === "success");
      } catch {
        setSubmissionResult(FALLBACK_SUBMISSION_ERROR);
        setSubmitted(false);
      }
    });
  }

  const statusMessage = isPending
    ? "Проверяем и сохраняем попытку..."
    : submissionResult?.message
      ?? (submitted ? model.labels.submittedMessage : model.labels.preSubmitMessage);

  return (
    <div className="asa-item asa-quiz-item" data-submission-status={submissionResult?.status ?? "idle"}>
      <section className="asa-quiz-intro"><div><h2>{model.labels.title}</h2><p>{model.labels.instructions}</p></div><div><strong>{selectedCount}</strong><span>/ {model.questions.length} {model.labels.selectedCountSuffix}</span></div></section>
      <form onSubmit={submitSelections} aria-busy={isPending}>
        {model.questions.map((question) => <fieldset key={question.id}><legend><span>{question.displayOrder}</span>{question.text}</legend><div>{question.options.map((option) => <label key={option.id} className={selectedOptions[question.id] === option.id ? "is-selected" : ""}><input type="radio" name={question.id} value={option.id} checked={selectedOptions[question.id] === option.id} onChange={() => { setSubmitted(false); setSubmissionResult(null); setSelectedOptions((current) => ({ ...current, [question.id]: option.id })); }} /><span>{option.displayLabel}</span><strong>{option.text}</strong></label>)}</div></fieldset>)}
        <div className="asa-quiz-submit"><p aria-live="polite">{statusMessage}</p><Button variant="dark" type="submit" disabled={selectedCount !== model.questions.length || isPending}>{isPending ? "Сохраняем..." : model.labels.submitButton}</Button></div>
      </form>
    </div>
  );
}
