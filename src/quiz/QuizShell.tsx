"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/src/design-system";
import type { QuizShellProps } from "./types";

export function QuizShell({ model }: QuizShellProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const selectedCount = Object.keys(selectedOptions).length;

  function submitSelections(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="asa-item asa-quiz-item">
      <section className="asa-quiz-intro"><div><h2>{model.labels.title}</h2><p>{model.labels.instructions}</p></div><div><strong>{selectedCount}</strong><span>/ {model.questions.length} {model.labels.selectedCountSuffix}</span></div></section>
      <form onSubmit={submitSelections}>
        {model.questions.map((question) => <fieldset key={question.id}><legend><span>{question.displayOrder}</span>{question.text}</legend><div>{question.options.map((option) => <label key={option.id} className={selectedOptions[question.id] === option.id ? "is-selected" : ""}><input type="radio" name={question.id} value={option.id} checked={selectedOptions[question.id] === option.id} onChange={() => { setSubmitted(false); setSelectedOptions((current) => ({ ...current, [question.id]: option.id })); }} /><span>{option.displayLabel}</span><strong>{option.text}</strong></label>)}</div></fieldset>)}
        <div className="asa-quiz-submit"><p aria-live="polite">{submitted ? model.labels.submittedMessage : model.labels.preSubmitMessage}</p><Button variant="dark" type="submit" disabled={selectedCount !== model.questions.length}>{model.labels.submitButton}</Button></div>
      </form>
    </div>
  );
}
