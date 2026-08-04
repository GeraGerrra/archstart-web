import Link from "next/link";
import { m01Lesson, m01Quiz } from "../content";
import type { DirectionId } from "../directions";
import { prototypePath } from "../directions";
import { ImageZoom } from "./ImageZoom";
import { PaperCompletion } from "./PaperCompletion";
import { PrototypeShell } from "./PrototypeShell";
import { PrototypeToggle } from "./PrototypeToggle";
import { QuizShell } from "./QuizShell";
import { TranscriptReader } from "./TranscriptReader";

interface LessonScreenProps {
  direction: DirectionId;
  initialCompleted?: boolean;
}

const LESSON_SECTIONS = [
  ["lesson-overview", "Обзор"],
  ["lesson-video", "Видео"],
  ["lesson-transcript", "Транскрипт"],
  ["lesson-vocabulary", "Vocabulary"],
  ["lesson-practice", "Practice"],
  ["lesson-pice", "PICE"],
  ["lesson-quiz", "Quiz"],
  ["lesson-resources", "Материалы"],
] as const;

export function LessonScreen({ direction, initialCompleted = false }: LessonScreenProps) {
  return (
    <PrototypeShell direction={direction} activeSurface="lesson">
      <div className="lesson-frame prototype-container">
        <aside className="lesson-rail" aria-label="Разделы урока">
          <div className="lesson-rail__identity">
            <span>{m01Lesson.code}</span>
            <strong>01 / 05</strong>
          </div>
          <nav>
            {LESSON_SECTIONS.map(([id, label], index) => (
              <a key={id} href={`#${id}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>{label}
              </a>
            ))}
          </nav>
          <p>Локальный demo state. Ничего не сохраняется.</p>
        </aside>

        <article className="lesson-content">
          <header id="lesson-overview" className="lesson-hero">
            <nav className="lesson-breadcrumb" aria-label="Хлебные крошки">
              <Link href={prototypePath(direction, "dashboard")}>Курс</Link>
              <span aria-hidden="true">/</span>
              <Link href={prototypePath(direction, "module")}>M01</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">L01</span>
            </nav>
            <div className="lesson-hero__meta">
              <span className="prototype-kicker">{m01Lesson.code} / LESSON 01</span>
              <span>PROTOTYPE · NO SAVED PROGRESS</span>
            </div>
            <h1>{m01Lesson.titleRu}</h1>
            <p className="prototype-subtitle">{m01Lesson.titleEn}</p>
            <div className="lesson-objective">
              <span>ЦЕЛЬ УРОКА</span>
              <p>{m01Lesson.objective}</p>
            </div>
            <div className="lesson-outcomes" aria-labelledby="outcomes-title">
              <h2 id="outcomes-title">После урока вы сможете</h2>
              <ol>
                {m01Lesson.learningOutcomes.map((outcome) => (
                  <li key={outcome.order}>
                    <span>{String(outcome.order).padStart(2, "0")}</span>
                    <div><strong>{outcome.label}</strong><p>{outcome.text}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </header>

          <section id="lesson-video" className="lesson-section video-section" aria-labelledby="video-title">
            <div className="lesson-section__heading">
              <div><span className="prototype-kicker">VIDEO / 16:9</span><h2 id="video-title">Видео урока</h2></div>
              <span>YOUTUBE ID NOT SUPPLIED</span>
            </div>
            <div className="video-pending" role="img" aria-label="Видео пока не предоставлено">
              <span>VIDEO PENDING</span>
              <p>Нейтральное состояние прототипа. URL и thumbnail не придуманы.</p>
            </div>
          </section>

          <section id="lesson-transcript" className="lesson-section" aria-labelledby="transcript-title">
            <div className="lesson-section__heading">
              <div><span className="prototype-kicker">{m01Lesson.transcript.sectionCount} REAL SECTIONS</span><h2 id="transcript-title">Транскрипт</h2></div>
              <span>{m01Lesson.transcript.sectionCount} SECTIONS</span>
            </div>
            <TranscriptReader sections={m01Lesson.transcript.sections} />
          </section>

          <section id="lesson-vocabulary" className="lesson-section" aria-labelledby="vocabulary-title">
            <div className="lesson-section__heading">
              <div><span className="prototype-kicker">VOCABULARY</span><h2 id="vocabulary-title">Термины урока</h2></div>
              <span>{m01Lesson.vocabularyEntries.length} TERMS</span>
            </div>
            <div className="vocabulary-list">
              {m01Lesson.vocabularyEntries.map((entry) => (
                <details key={entry.number}>
                  <summary>
                    <span>{String(entry.number).padStart(2, "0")}</span>
                    <strong>{entry.termEn}</strong>
                    <em>{entry.termRu}</em>
                  </summary>
                  <div>
                    <p>{entry.definition}</p>
                    <p><span>В контексте:</span> {entry.contextExample}</p>
                    <small>Источник: vocabulary page {entry.sourcePage}</small>
                  </div>
                </details>
              ))}
            </div>
            <PrototypeToggle
              label="Vocabulary reviewed"
              description="Локальная отметка для демонстрации контроля. Не сохраняется."
            />
          </section>

          <section id="lesson-practice" className="lesson-section practice-section" aria-labelledby="practice-title">
            <div className="lesson-section__heading">
              <div><span className="prototype-kicker">PRACTICE-ONLY MINI-OUTPUT</span><h2 id="practice-title">{m01Lesson.miniOutput.title.ru}</h2></div>
              <span>{m01Lesson.miniOutput.estimatedTime}</span>
            </div>
            <p className="prototype-subtitle">{m01Lesson.miniOutput.title.en}</p>
            <p>{m01Lesson.miniOutput.purpose}</p>
            <div className="practice-brief">
              <div><span>ЗАДАЧА</span><strong>{m01Lesson.miniOutput.studentTask}</strong></div>
              <div><span>СТАТУС</span><p>{m01Lesson.miniOutput.status}</p></div>
            </div>
            <ol className="practice-steps">
              {m01Lesson.miniOutput.orderedSteps.map((step) => (
                <li key={step.order}><span>{String(step.order).padStart(2, "0")}</span><p>{step.text}</p></li>
              ))}
            </ol>
          </section>

          <section id="lesson-pice" className="lesson-section pice-section" aria-labelledby="pice-title">
            <div className="lesson-section__heading">
              <div><span className="prototype-kicker">ACTUAL COURSE DIAGRAM</span><h2 id="pice-title">Пример mini-output</h2></div>
              <span>PIXEL-PRESERVED · METADATA STRIPPED</span>
            </div>
            <ImageZoom
              src="/prototype-assets/m01-l01-pice.png"
              alt="Нарисованная от руки 5-Layer Architectural Reading Diagram для учебного уголка"
              width={1653}
              height={2337}
              caption="M01_L01_PICE / actual source asset / displayed with a non-destructive 90° layout rotation"
              rotateToLandscape
            />
          </section>

          <section id="lesson-quiz" className="lesson-section" aria-labelledby="quiz-title">
            <div className="lesson-section__heading">
              <div><span className="prototype-kicker">PUBLIC QUIZ PAYLOAD</span><h2 id="quiz-title">Проверка понимания</h2></div>
              <span>5 QUESTIONS · ANSWERS EXCLUDED</span>
            </div>
            <QuizShell lessonCode={m01Quiz.lessonCode} questions={m01Quiz.questions} />
          </section>

          <section id="lesson-resources" className="lesson-section resources-section" aria-labelledby="resources-title">
            <div className="lesson-section__heading">
              <div><span className="prototype-kicker">RESOURCE STRUCTURE</span><h2 id="resources-title">Материалы урока</h2></div>
              <span>RAW PDF / PPTX NOT PUBLISHED</span>
            </div>
            <div className="resource-rows">
              <div><strong>Vocabulary PDF</strong><span>Source supplied · sanitized browser download deferred</span><button type="button" disabled>DOWNLOAD PENDING</button></div>
              <div><strong>Lesson presentation</strong><span>Source exists · public presentation file deferred</span><button type="button" disabled>DOWNLOAD PENDING</button></div>
              <div><strong>Practice diagram</strong><span>Просмотр доступен выше с полным zoom</span><a href="#lesson-pice">Открыть</a></div>
            </div>
          </section>

          <nav className="lesson-prev-next" aria-label="Переход между уроками">
            <span aria-disabled="true"><small>Предыдущий</small><strong>Начало модуля</strong></span>
            <Link href={`${prototypePath(direction, "module")}#lesson-list`}>
              <small>Следующий</small><strong>M01_L02 · маршрут отложен</strong>
            </Link>
          </nav>

          <PaperCompletion
            kind="lesson"
            initialCompleted={initialCompleted}
            title="УРОК ЗАВЕРШЁН"
            message="Вы прочитали архитектуру глубже фасада и связали пользователя, функцию, движение, контекст и решение."
          />
        </article>
      </div>
    </PrototypeShell>
  );
}
