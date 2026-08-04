"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { PendingMaterial } from "@/src/design-system";
import { splitSearchMatches } from "./searchHighlight";
import type { LectureMaterialsViewerProps, TranscriptSectionViewModel } from "./types";

export function highlightSearchMatch(text: string, query: string): ReactNode {
  if (!query) return text;
  return splitSearchMatches(text, query).map((segment, index) => segment.isMatch
    ? <mark className="asa-lm-search-mark" key={`${index}-${segment.text}`}>{segment.text}</mark>
    : segment.text);
}

export function LectureMaterialsViewer({ model }: LectureMaterialsViewerProps) {
  const [activeSlide, setActiveSlide] = useState(1);
  const [search, setSearch] = useState("");
  const [mobileTranscriptOpen, setMobileTranscriptOpen] = useState(false);
  const transcriptRef = useRef<HTMLElement | null>(null);
  const slideFrameId = useId();
  const transcriptSectionsId = useId();
  const sections = model.transcriptSections;
  const lectureAssets = model.slides;
  const totalSlides = lectureAssets?.paths.length ?? 0;
  const hasSlides = totalSlides > 0;

  const filtered = useMemo(
    () => sections.filter((section) => `${section.id} ${section.text}`.toLowerCase().includes(search.toLowerCase())),
    [sections, search],
  );

  // Slide changes keep the matching SNN section in view when approved slides exist.
  useEffect(() => {
    if (!hasSlides) return;
    const section = sections.find((entry) => entry.order === activeSlide);
    if (section) {
      const element = document.getElementById(`lm-section-${section.id}`);
      if (element) {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        element.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
      }
    }
  }, [activeSlide, hasSlides, sections]);

  function handleSectionClick(section: TranscriptSectionViewModel) {
    if (!hasSlides) return;
    setActiveSlide(section.order);
  }

  const currentSlide = Math.max(1, Math.min(totalSlides || 1, activeSlide));
  const slideSrc = lectureAssets?.paths[currentSlide - 1];
  const activeSection = hasSlides ? sections.find((section) => section.order === currentSlide)?.id ?? null : null;
  const mobileActiveSection = activeSection ?? sections[0]?.id ?? null;

  return (
    <div className="asa-item asa-lecture-materials">
      <div className="asa-lm-toolbar">
        <label className="asa-lm-search asa-lm-search--desktop">
          <span>Поиск по транскрипту</span>
          <input type="search" value={search} onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} placeholder="Найти в транскрипте" />
        </label>
        {lectureAssets?.presentationPdfPath ? <a className="asa-button asa-button--line" href={lectureAssets.presentationPdfPath} target="_blank" rel="noreferrer" download>Скачать PDF презентации</a> : null}
      </div>

      <div className={`asa-lm-layout${hasSlides ? "" : " asa-lm-layout--pending"}`}>
        {hasSlides && lectureAssets && slideSrc ? (
          <div className="asa-lm-slides">
            <div className="asa-lm-slide-viewer">
              <div className="asa-lm-slide-frame" id={slideFrameId} aria-live="polite">
                <Image
                  src={slideSrc}
                  alt={`Слайд ${currentSlide} из ${totalSlides}`}
                  width={lectureAssets.width}
                  height={lectureAssets.height}
                  priority={currentSlide === 1}
                />
              </div>
              <nav className="asa-lm-slide-nav" aria-label="Навигация по слайдам">
                <button type="button" onClick={() => setActiveSlide((value) => Math.max(1, value - 1))} disabled={currentSlide === 1} aria-label="Предыдущий слайд">←</button>
                <span aria-label={`Слайд ${currentSlide} из ${totalSlides}`}>{currentSlide} / {totalSlides}</span>
                <button type="button" onClick={() => setActiveSlide((value) => Math.min(totalSlides, value + 1))} disabled={currentSlide === totalSlides} aria-label="Следующий слайд">→</button>
              </nav>
            </div>
            <ol className="asa-lm-slide-strip" aria-label="Миниатюры слайдов">
              {lectureAssets.paths.map((src, index) => {
                const slideNumber = index + 1;
                return (
                  <li key={src}>
                    <button
                      type="button"
                      className={slideNumber === currentSlide ? "is-active" : ""}
                      onClick={() => setActiveSlide(slideNumber)}
                      aria-pressed={slideNumber === currentSlide}
                      aria-label={`Слайд ${slideNumber}`}
                      aria-controls={slideFrameId}
                    >
                      <Image src={src} alt="" width={320} height={180} />
                      <span>{slideNumber}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          <PendingMaterial className="asa-lm-slides__pending" message={model.pendingMaterialMessage} />
        )}

        <article className={`asa-lm-transcript${mobileTranscriptOpen ? " is-expanded" : ""}`} ref={transcriptRef} aria-label="Транскрипт лекции">
          <header className="asa-lm-transcript__head">
            <button
              type="button"
              className="asa-lm-transcript__toggle"
              aria-expanded={mobileTranscriptOpen}
              aria-controls={transcriptSectionsId}
              onClick={() => {
                setMobileTranscriptOpen((current) => {
                  if (current) setSearch("");
                  return !current;
                });
              }}
            >
              {mobileTranscriptOpen ? "Свернуть транскрипт" : "Весь транскрипт"}
              <span aria-hidden="true">{mobileTranscriptOpen ? "−" : "+"}</span>
            </button>
            <label className="asa-lm-search asa-lm-search--mobile">
              <span>Поиск по транскрипту</span>
              <input type="search" value={search} onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} placeholder="Найти в транскрипте" />
            </label>
          </header>
          <div className="asa-lm-transcript__sections" id={transcriptSectionsId}>
            {filtered.map((section) => hasSlides ? (
              <button
                type="button"
                key={section.id}
                id={`lm-section-${section.id}`}
                className={`asa-lm-section${section.id === activeSection ? " is-active" : ""}${section.id === mobileActiveSection ? " is-mobile-active" : ""}`}
                onClick={() => handleSectionClick(section)}
                aria-current={section.id === activeSection ? "true" : undefined}
                aria-controls={slideFrameId}
              >
                <span className="asa-lm-section__meta">
                  <span>{highlightSearchMatch(section.id, search)}</span>
                  <small>СЛАЙД {String(section.order).padStart(2, "0")}</small>
                </span>
                <span className="asa-lm-section__text">{highlightSearchMatch(section.text, search)}</span>
              </button>
            ) : (
              <section key={section.id} id={`lm-section-${section.id}`} className={`asa-lm-section asa-lm-section--static${section.id === mobileActiveSection ? " is-mobile-active" : ""}`}>
                <span className="asa-lm-section__meta"><span>{highlightSearchMatch(section.id, search)}</span></span>
                <span className="asa-lm-section__text">{highlightSearchMatch(section.text, search)}</span>
              </section>
            ))}
            {filtered.length === 0 && search ? <p className="asa-lm-empty">Ничего не найдено по запросу «{search}».</p> : null}
          </div>
        </article>
      </div>
    </div>
  );
}
