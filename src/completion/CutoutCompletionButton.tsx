"use client";

import Image from "next/image";
import { type CSSProperties, useId, useState } from "react";
import { TextLink, VisuallyHidden } from "@/src/design-system";
import { LESSON_FRAGMENTS, MODULE_FRAGMENTS } from "./paperFragments";
import type { CutoutCompletionButtonProps } from "./types";

/**
 * Selected-A-compatible completion control. The cutout image remains the
 * semantic pressed button; undo is a separate quiet action.
 */
export function CutoutCompletionButton({ model }: CutoutCompletionButtonProps) {
  const [state, setState] = useState(model.initialState);
  const [interacted, setInteracted] = useState(false);
  const [announcement, setAnnouncement] = useState(
    model.initialState === "complete" ? `${model.completedTitle}. ${model.completedMessage}` : "",
  );
  const headingId = useId();
  const liveId = useId();
  const locked = state === "locked";
  const complete = state === "complete";
  const fragments = model.kind === "lesson" ? LESSON_FRAGMENTS : MODULE_FRAGMENTS;
  const title = locked ? model.lockedTitle : complete ? model.completedTitle : model.beforeTitle;
  const message = locked ? model.lockedMessage : complete ? model.completedMessage : model.beforeMessage;

  function handleComplete() {
    if (state !== "ready") return;
    setInteracted(true);
    setState("complete");
    setAnnouncement(`${model.completedTitle}. ${model.completedMessage}`);
  }

  function handleRemove() {
    if (state !== "complete") return;
    setState("ready");
    setAnnouncement("Отметка снята.");
  }

  return (
    <section
      className={`asa-cutout-completion asa-cutout-completion--${model.kind}${locked ? " is-locked" : ""}${complete ? " is-complete" : ""}${interacted ? " has-interacted" : ""}`}
      aria-labelledby={headingId}
    >
      <div className="asa-cutout-completion__copy">
        <h2 id={headingId}>{title}</h2>
        <p>{message}</p>
      </div>
      <button
        type="button"
        className="asa-cutout-completion__btn"
        disabled={locked}
        aria-pressed={locked ? "false" : complete}
        aria-disabled={locked || complete}
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
          <button type="button" className="asa-cutout-completion__undo" onClick={handleRemove}>{model.undoLabel}</button>
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
