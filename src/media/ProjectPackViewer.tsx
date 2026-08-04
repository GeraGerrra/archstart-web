"use client";

import Image from "next/image";
import { type CSSProperties, useId, useState } from "react";

export interface ProjectPackViewerProps {
  title: string;
  pdfPath: string;
  pageImagePaths: readonly string[];
  pageWidth: number;
  pageHeight: number;
}

export function ProjectPackViewer({ title, pdfPath, pageImagePaths, pageWidth, pageHeight }: ProjectPackViewerProps) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const viewerId = useId();
  const pageCount = pageImagePaths.length;
  const currentPage = Math.max(1, Math.min(pageCount, page));
  const currentImage = pageImagePaths[currentPage - 1] ?? pageImagePaths[0];

  if (!currentImage || pageCount === 0) return null;

  function move(next: number) {
    setPage(Math.max(1, Math.min(pageCount, next)));
  }

  return (
    <section className="asa-project-pack" aria-label={`${title}: многостраничный пример`}>
      <header className="asa-project-pack__header">
        <div><span className="asa-kicker">MULTI_PAGE_PACK</span><h3>{title}</h3><p>Полный пример состоит из {pageCount} страниц и сохранён как единый многостраничный пакет.</p></div>
        <div className="asa-project-pack__file-actions">
          <a className="asa-button asa-button--line" href={pdfPath} target="_blank" rel="noreferrer">Открыть PDF</a>
          <a className="asa-button asa-button--line" href={pdfPath} download>Скачать PDF</a>
        </div>
      </header>
      <div className="asa-project-pack__toolbar">
        <div>
          <button type="button" onClick={() => move(currentPage - 1)} disabled={currentPage === 1} aria-label="Предыдущая страница">←</button>
          <span aria-live="polite">Страница <strong>{currentPage}</strong> / {pageCount}</span>
          <button type="button" onClick={() => move(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Следующая страница">→</button>
        </div>
        <div>
          <button type="button" onClick={() => setZoom((value) => Math.max(70, value - 10))} aria-label="Уменьшить">−</button>
          <span>{zoom}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(180, value + 10))} aria-label="Увеличить">+</button>
          <button type="button" onClick={() => setZoom(100)}>По ширине</button>
        </div>
      </div>
      <div className="asa-project-pack__viewer" id={viewerId} style={{ "--project-pack-zoom": `${zoom}%` } as CSSProperties}>
        <Image src={currentImage} alt={`${title}, страница ${currentPage} из ${pageCount}`} width={pageWidth} height={pageHeight} priority={currentPage === 1} />
      </div>
      <ol className="asa-project-pack__pages" aria-label="Страницы примера">
        {pageImagePaths.map((src, index) => {
          const number = index + 1;
          return <li key={src}><button type="button" onClick={() => move(number)} className={number === currentPage ? "is-active" : ""} aria-current={number === currentPage ? "page" : undefined} aria-controls={viewerId}><Image src={src} alt="" width={240} height={135} /><span>{String(number).padStart(2, "0")}</span></button></li>;
        })}
      </ol>
    </section>
  );
}
