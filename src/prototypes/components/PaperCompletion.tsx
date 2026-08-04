"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { CSSProperties } from "react";

const PAPER_FRAGMENTS = Array.from({ length: 12 }, (_, index) => index);

interface PaperCompletionProps {
  kind: "lesson" | "module";
  initialCompleted?: boolean;
  title: string;
  message: string;
}

export function PaperCompletion({
  kind,
  initialCompleted = false,
  title,
  message,
}: PaperCompletionProps) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [hasInteracted, setHasInteracted] = useState(false);
  const confirmationId = useId();

  function toggleCompletion() {
    setHasInteracted(true);
    setCompleted((current) => !current);
  }

  const controlLabel =
    kind === "lesson" ? "Отметить урок завершённым" : "Отметить модуль завершённым";

  return (
    <section
      className={`paper-completion paper-completion--${kind} ${
        completed ? "is-completed" : ""
      } ${hasInteracted ? "has-interacted" : ""}`}
      aria-labelledby={`${confirmationId}-title`}
    >
      <div className="paper-completion__copy">
        <span className="prototype-kicker">LOCAL PROTOTYPE STATE</span>
        <h2 id={`${confirmationId}-title`}>{completed ? title : controlLabel}</h2>
        <p>{completed ? message : "Состояние хранится только на этой странице и не является реальным прогрессом."}</p>
        <button
          type="button"
          className="prototype-button prototype-button--dark paper-completion__button"
          aria-pressed={completed}
          aria-describedby={confirmationId}
          onClick={toggleCompletion}
        >
          <span aria-hidden="true" className="paper-completion__check">✓</span>
          {completed ? "Отменить отметку" : controlLabel}
        </button>
        <p id={confirmationId} className="sr-only" aria-live="polite">
          {completed ? `${title}. ${message}` : "Отметка снята. Прогресс не сохраняется."}
        </p>
      </div>

      <div className="paper-completion__visual" aria-hidden="true">
        <span className="paper-completion__sheet">
          <Image
            src="/prototype-assets/m01-sketch.png"
            alt=""
            width={2048}
            height={1117}
            className="paper-completion__sketch"
          />
          <span className="paper-completion__graphite-check">✓</span>
        </span>
        <span className="paper-fragments">
          {PAPER_FRAGMENTS.map((index) => (
            <span
              key={index}
              className="paper-fragment"
              style={{ "--fragment-index": index } as CSSProperties}
            />
          ))}
        </span>
      </div>
    </section>
  );
}
