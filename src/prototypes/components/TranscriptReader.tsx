"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";

interface TranscriptSection {
  id: string;
  order: number;
  text: string;
}

interface TranscriptReaderProps {
  sections: TranscriptSection[];
}

export function TranscriptReader({ sections }: TranscriptReaderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSection = sections[activeIndex] ?? sections[0];

  if (!activeSection) {
    return null;
  }

  return (
    <div className="transcript-reader">
      <div className="transcript-reader__toolbar">
        <label className="transcript-reader__select-label">
          <span>Раздел транскрипта</span>
          <select
            value={activeIndex}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setActiveIndex(Number(event.target.value))}
          >
            {sections.map((section, index) => (
              <option value={index} key={section.id}>
                {section.id} / {sections.length}
              </option>
            ))}
          </select>
        </label>
        <div className="transcript-reader__count" aria-live="polite">
          {activeSection.id} · {activeIndex + 1} из {sections.length}
        </div>
      </div>

      <nav className="transcript-reader__nav" aria-label="Навигация по разделам транскрипта">
        {sections.map((section, index) => (
          <button
            type="button"
            key={section.id}
            className={index === activeIndex ? "is-active" : ""}
            aria-current={index === activeIndex ? "step" : undefined}
            onClick={() => setActiveIndex(index)}
          >
            {section.id}
          </button>
        ))}
      </nav>

      <article className="transcript-reader__content" aria-labelledby={`transcript-${activeSection.id}`}>
        <span className="prototype-kicker">TRANSCRIPT / {activeSection.id}</span>
        <h3 id={`transcript-${activeSection.id}`}>Раздел {activeSection.order}</h3>
        {activeSection.text.split("\n").map((paragraph, index) => (
          <p key={`${activeSection.id}-${index}`}>{paragraph}</p>
        ))}
      </article>

      <div className="transcript-reader__pager">
        <button
          type="button"
          className="prototype-button prototype-button--line"
          disabled={activeIndex === 0}
          onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
        >
          Предыдущий раздел
        </button>
        <button
          type="button"
          className="prototype-button prototype-button--line"
          disabled={activeIndex === sections.length - 1}
          onClick={() => setActiveIndex((index) => Math.min(sections.length - 1, index + 1))}
        >
          Следующий раздел
        </button>
      </div>
    </div>
  );
}
