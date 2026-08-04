import Link from "next/link";
import { m01Lessons, m01Module, m01Project, projectIdentity, moduleCompletionMessage } from "../content";
import type { DirectionId } from "../directions";
import { prototypePath } from "../directions";
import { ImageZoom } from "./ImageZoom";
import { PaperCompletion } from "./PaperCompletion";
import { PrototypeShell } from "./PrototypeShell";

interface ModuleScreenProps {
  direction: DirectionId;
  initialCompleted?: boolean;
}

export function ModuleScreen({ direction, initialCompleted = false }: ModuleScreenProps) {
  return (
    <PrototypeShell direction={direction} activeSurface="module">
      <section className="module-hero prototype-container">
        <div className="module-hero__code" aria-hidden="true">M01</div>
        <div className="module-hero__copy">
          <span className="prototype-kicker">MODULE 01 / DEMO PROGRESS 1 OF 5</span>
          <h1>{m01Module.titleRu}</h1>
          <p className="prototype-subtitle">{m01Module.titleEn}</p>
          <p className="prototype-lead">{m01Module.goal}</p>
          <div className="module-progress" aria-label="Демонстрационный прогресс модуля: 1 урок из 5">
            <span>1 / 5 уроков · локальный прототип</span>
            <progress value={1} max={5}>1 из 5</progress>
          </div>
        </div>
      </section>

      <section id="lesson-list" className="module-lessons prototype-container" aria-labelledby="lessons-title">
        <div className="section-heading section-heading--inline">
          <div>
            <span className="prototype-kicker">LESSON SEQUENCE</span>
            <h2 id="lessons-title">Пять уроков</h2>
          </div>
          <span>REAL M01 METADATA</span>
        </div>
        <ol>
          {m01Lessons.map((lesson) => (
            <li key={lesson.code} className={lesson.code === "M01_L01" ? "is-current" : ""}>
              <div className="module-lessons__index">{String(lesson.orderInModule).padStart(2, "0")}</div>
              <div className="module-lessons__title">
                <span>{lesson.code}</span>
                <strong>{lesson.titleRu}</strong>
                <small>{lesson.titleEn}</small>
              </div>
              <div className="module-lessons__meta">
                <span>{lesson.transcript.sectionCount} transcript sections</span>
                <span>{lesson.vocabularyEntries.length} vocabulary terms</span>
              </div>
              {lesson.code === "M01_L01" ? (
                <Link href={prototypePath(direction, "lesson")}>Открыть урок</Link>
              ) : (
                <span className="route-placeholder">Контент есть · маршрут отложен</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="module-project prototype-container" aria-labelledby="project-title">
        <div className="module-project__copy">
          <span className="prototype-kicker">{m01Project.code} / MODULE PROJECT</span>
          <h2 id="project-title">{m01Project.titleRu}</h2>
          <p className="prototype-subtitle">{m01Project.titleEn}</p>
          <p>{m01Project.objective}</p>
          {projectIdentity.mainQuestion ? <p className="project-question">{projectIdentity.mainQuestion}</p> : null}
          <dl>
            <div><dt>Формат</dt><dd>{m01Project.formatType}</dd></div>
            <div><dt>Время</dt><dd>{projectIdentity.estimatedTime ?? "Указано в реальном project brief"}</dd></div>
          </dl>
        </div>
        <ImageZoom
          src="/prototype-assets/m01-project-01-preview.png"
          alt="Реальный пример итогового планшета проекта M01 Space Reading Board"
          width={2001}
          height={1125}
          caption="Project 01 / actual board preview / metadata-sanitized derivative"
        />
      </section>

      <section className="module-downloads prototype-container" aria-labelledby="module-downloads-title">
        <div>
          <span className="prototype-kicker">VOCABULARY &amp; DOWNLOAD STRUCTURE</span>
          <h2 id="module-downloads-title">Материалы модуля</h2>
        </div>
        <div className="resource-rows">
          <div><strong>M01 Vocabulary Pack</strong><span>Структурный placeholder · файл не опубликован</span><button type="button" disabled>DOWNLOAD PENDING</button></div>
          <div><strong>Project 01 Student Page</strong><span>Структурный placeholder · DOCX не публикуется в Phase 02</span><button type="button" disabled>DOWNLOAD PENDING</button></div>
        </div>
      </section>

      <div className="prototype-container completion-wrap">
        <PaperCompletion
          kind="module"
          initialCompleted={initialCompleted}
          title="YOU READ THE SPACE"
          message={moduleCompletionMessage}
        />
      </div>
    </PrototypeShell>
  );
}
