import { Button } from "@/src/design-system";
import type { VideoItemProps } from "./types";

export function VideoItem({ model }: VideoItemProps) {
  const videoTitle = `Видеолекция ${model.lessonDisplayCode}: ${model.lessonTitleRu}`;
  return (
    <div className="asa-item asa-video-item">
      <section className={`asa-video-frame${model.youtube ? " has-embed" : ""}`} aria-label="Видеолекция">
        {model.youtube ? (
          <iframe
            src={model.youtube.embedUrl}
            title={videoTitle}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : <div><div className="asa-video-frame__index">{model.lessonDisplayCode}</div><h2>Видеолекция</h2><p>{model.pendingMediaMessage}</p></div>}
      </section>
      <section className="asa-video-meta"><div><span>Урок</span><strong>{model.lessonTitleRu}</strong><small>{model.lessonTitleEn}</small></div></section>
      <section className="asa-video-links"><div><h2>Слайды и транскрипт в едином просмотрщике</h2></div>{model.youtube ? <Button href={model.youtube.watchUrl} target="_blank" rel="noreferrer" variant="line">Открыть на YouTube</Button> : null}<Button href={model.lectureMaterialsAction.href} variant="line">{model.lectureMaterialsAction.label}</Button></section>
    </div>
  );
}
