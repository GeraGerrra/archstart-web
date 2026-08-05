"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  useId,
  useState,
  useTransition,
} from "react";
import { TextLink, VisuallyHidden } from "@/src/design-system";
import { LESSON_FRAGMENTS, MODULE_FRAGMENTS } from "./paperFragments";
import type {
  CompletionMutationResult,
  CutoutCompletionButtonProps,
} from "./types";

const FALLBACK_MUTATION_ERROR: CompletionMutationResult = {
  status: "error",
  state: "locked",
  message: "Не удалось изменить отметку. Попробуйте ещё раз.",
};

/**
 * Selected-A-compatible completion control. With no Server Actions it keeps
 * the accepted local demo behavior; production routes pass persistent actions.
 */
export function CutoutCompletionButton({
  model,
  completeAction,
  undoAction,
}: CutoutCompletionButtonProps) {
  const router = useRouter();
  const [state, setState] = useState(model.initialState);
  const [interacted, setInteracted] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState(
    model.initialState === "complete" ? `${model.completedTitle}. ${model.completedMessage}` : "",
  );
  const [isPending, startTransition] = useTransition();
  const headingId = useId();
  const liveId = useId();
  const locked = state === "locked";
  const complete = state === "complete";
  const fragments = model.kind === "lesson" ? LESSON_FRAGMENTS : MODULE_FRAGMENTS;
  const title = locked ? model.lockedTitle : complete ? model.completedTitle : model.beforeTitle;
  const defaultMessage = locked ? model.lockedMessage : complete ? model.completedMessage : model.beforeMessage;
  const message = feedbackMessage ?? defaultMessage;

  function applyPersistentResult(result: CompletionMutationResult, interaction: "complete" | "undo") {
    setState(result.state);
    setFeedbackMessage(result.message);
    setAnnouncement(result.message);
    setInteracted(
      interaction === "complete"
      && result.status === "success"
      && result.state === "complete",
    );

    if (result.status === "success") router.refresh();
  }

  function handleComplete() {
    if (state !== "ready" || isPending) return;

    if (!completeAction) {
      setInteracted(true);
      setState("complete");
      setAnnouncement(`${model.completedTitle}. ${model.completedMessage}`);
      return;
    }

    startTransition(async () => {
      try {
        applyPersistentResult(await completeAction(), "complete");
      } catch {
        applyPersistentResult(
          { ...FALLBACK_MUTATION_ERROR, state: "ready" },
          "complete",
        );
      }
    });
  }

  function handleRemove() {
    if (state !== "complete" || isPending) return;

    if (!undoAction) {
      setState("ready");
      setInteracted(false);
      setFeedbackMessage(null);
      setAnnouncement("Отметка снята.");
      return;
    }

    startTransition(async () => {
      try {
        applyPersistentResult(await undoAction(), "undo");
      } catch {
        applyPersistentResult(
          { ...FALLBACK_MUTATION_ERROR, state: "complete" },
          "undo",
        );
      }
    });
  }

  return (
    <section
      className={`asa-cutout-completion asa-cutout-completion--${model.kind}${locked ? " is-locked" : ""}${complete ? " is-complete" : ""}${interacted ? " has-interacted" : ""}`}
      aria-labelledby={headingId}
      aria-busy={isPending}
      data-completion-state={state}
    >
      <div className="asa-cutout-completion__copy">
        <h2 id={headingId}>{title}</h2>
        <p>{isPending ? "Сохраняем изменение..." : message}</p>
      </div>
      <button
        type="button"
        className="asa-cutout-completion__btn"
        disabled={locked || isPending}
        aria-pressed={locked ? "false" : complete}
        aria-disabled={locked || complete || isPending}
        onClick={handleComplete}
        aria-label={locked ? model.lockedLabel : complete ? model.completedTitle : model.actionLabel}
      >
        <Image
          src={model.cutout.src}
          alt={model.cutout.alt}
          width={model.cutout.width}
          height={model.cutout.height}
        />
        {locked ? null : (
          <>
            <svg className="asa-cutout-completion__check" viewBox="0 0 56 52" aria-hidden="true" focusable="false">
              <path d="M 8 29 L 21 41 L 49 10" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="square" strokeLinejoin="miter" />
            </svg>
            {fragments.map((fragment, index) => (
              <i
                key={fragment.id}
                className="asa-paper-frag"
                data-pattern={fragment.pattern}
                data-shape={fragment.shape}
                style={{
                  "--fragment-origin-x": fragment.originX,
                  "--fragment-origin-y": fragment.originY,
                  "--fragment-travel-x": fragment.travelX,
                  "--fragment-travel-y": fragment.travelY,
                  "--fragment-rotation": fragment.rotation,
                  "--fragment-width": fragment.width,
                  "--fragment-height": fragment.height,
                  "--fragment-index": index,
                } as CSSProperties}
              />
            ))}
          </>
        )}
      </button>
      {complete ? (
        <div className="asa-cutout-completion__actions">
          {model.nextAction ? <TextLink href={model.nextAction.href}>{model.nextAction.label}</TextLink> : null}
          <button
            type="button"
            className="asa-cutout-completion__undo"
            onClick={handleRemove}
            disabled={isPending}
          >
            {model.undoLabel}
          </button>
        </div>
      ) : null}
      {locked ? null : (
        <VisuallyHidden as="p" id={liveId} aria-live="polite">
          {announcement}
        </VisuallyHidden>
      )}
    </section>
  );
}
