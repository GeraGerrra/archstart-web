"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { PendingMaterial } from "@/src/design-system";
import type { VocabularyEntryViewModel, VocabularyViewerProps } from "./types";

export function VocabularyViewer({ model }: VocabularyViewerProps) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [search, setSearch] = useState("");
  const [currentTermNumber, setCurrentTermNumber] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const matching = useMemo(
    () => model.entries.filter((entry) => `${entry.termEn} ${entry.termRu}`.toLowerCase().includes(search.toLowerCase())),
    [model.entries, search],
  );
  const vocabularyAssets = model.material;

  if (!vocabularyAssets) {
    return <div className="asa-item asa-vocabulary-item"><PendingMaterial message={model.pendingMaterialMessage} /></div>;
  }

  const pageCount = vocabularyAssets.pageImagePaths.length;
  const currentPage = Math.max(1, Math.min(pageCount, page));
  const currentPageImage = vocabularyAssets.pageImagePaths[currentPage - 1] ?? vocabularyAssets.pageImagePaths[0]!;

  function moveToPage(nextPage: number) {
    setCurrentTermNumber(null);
    setPage(Math.max(1, Math.min(pageCount, nextPage)));
  }

  function activateTerm(entry: VocabularyEntryViewModel) {
    setPage(Math.max(1, Math.min(pageCount, entry.sourcePage)));
    setCurrentTermNumber(entry.number);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewerRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || matching.length !== 1) return;
    event.preventDefault();
    activateTerm(matching[0]!);
  }

  return (
    <div className="asa-item asa-vocabulary-item">
      <section className="asa-vocabulary-intro"><div><h2>Визуальный словарь урока</h2><p>Трёхстраничный PDF остаётся основным учебным объектом. Индекс терминов помогает перейти к нужной странице.</p></div><div className="asa-vocabulary-actions"><a className="asa-button asa-button--line" href={vocabularyAssets.pdfPath} target="_blank" rel="noreferrer">Открыть отдельно</a><a className="asa-button asa-button--line" href={vocabularyAssets.pdfPath} download>Скачать PDF</a></div></section>
      <div className="asa-vocabulary-layout">
        <aside className="asa-term-index"><label><span>Поиск термина</span><input type="search" value={search} onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} onKeyDown={handleSearchKeyDown} placeholder="Architecture…" /></label><ol>{matching.map((entry) => <li key={entry.number}><button type="button" onClick={() => activateTerm(entry)} aria-current={currentTermNumber === entry.number ? "page" : undefined}><span>{String(entry.number).padStart(2, "0")}</span><div><strong>{entry.termEn}</strong><small>{entry.termRu}</small></div><span>p.{entry.sourcePage}</span></button></li>)}</ol></aside>
        <section className="asa-pdf" aria-label="PDF словаря">
          <div className="asa-pdf__toolbar">
            <div><button type="button" onClick={() => moveToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Предыдущая страница">←</button><span>Страница <strong>{currentPage}</strong> / {pageCount}</span><button type="button" onClick={() => moveToPage(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Следующая страница">→</button></div>
            <div><button type="button" onClick={() => setZoom((current) => Math.max(70, current - 10))} aria-label="Уменьшить">−</button><span>{zoom}%</span><button type="button" onClick={() => setZoom((current) => Math.min(180, current + 10))} aria-label="Увеличить">+</button><button type="button" onClick={() => setZoom(100)}>По ширине</button><button type="button" onClick={() => viewerRef.current?.requestFullscreen?.()}>На весь экран</button></div>
          </div>
          <div className="asa-pdf__viewer" ref={viewerRef} style={{ "--pdf-zoom": `${zoom}%` } as CSSProperties}>
            <div className="asa-pdf__page">
              <Image
                src={currentPageImage}
                alt={`Страница ${currentPage} словаря ${model.lessonDisplayCode}`}
                width={vocabularyAssets.pageWidth}
                height={vocabularyAssets.pageHeight}
                priority={currentPage === 1}
              />
            </div>
          </div>
          <p className="asa-pdf__fallback-link">Не видите документ? <a href={vocabularyAssets.pdfPath} target="_blank" rel="noreferrer">Откройте PDF в новой вкладке.</a></p>
        </section>
      </div>
      <section className={`asa-review-control${reviewed ? " is-reviewed" : ""}`}>
        <div><h2 className="asa-review-control__title">Отметка просмотра словаря</h2><p>Отметка появляется только после явного нажатия и не ставится при простом открытии страницы.</p></div>
        <button type="button" className="asa-button asa-button--dark" aria-pressed={reviewed} onClick={() => setReviewed((current) => !current)}>{reviewed ? "✓ Словарь просмотрен" : "Отметить просмотренным"}</button>
      </section>
    </div>
  );
}
