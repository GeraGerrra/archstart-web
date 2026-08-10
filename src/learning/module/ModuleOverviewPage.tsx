"use client";

import Image from "next/image";
import { useState } from "react";
import { Button, ProgressBar, SectionHeading, StatusMark } from "@/src/design-system";
import { ModuleLessonBranch } from "./ModuleLessonBranch";
import { ModuleFurtherStudySection } from "./ModuleFurtherStudySection";
import type { ModuleOverviewPageProps } from "../types";

export function ModuleOverviewPage({
  model,
  initialExpandedLessonCode,
  completionContent,
}: ModuleOverviewPageProps) {
  const [openLesson, setOpenLesson] = useState<string | null>(initialExpandedLessonCode ?? null);

  return (
    <>
      <section className="asa-module-hero asa-container">
        <div className="asa-module-hero__visual">
          <Image
            src={model.cutout.src}
            alt={model.cutout.alt}
            width={model.cutout.width}
            height={model.cutout.height}
            priority={model.cutout.priority}
          />
        </div>
        <div className="asa-module-hero__copy">
          <div className="asa-module-hero__title">
            <span className="asa-module-hero__code">{model.code}</span>
            <div className="asa-module-hero__titles">
              <h1>{model.titleRu}</h1>
              <p>{model.titleEn}</p>
            </div>
          </div>
          <p className="asa-lead">{model.goal}</p>
          <ProgressBar value={model.completedLessons} max={model.lessonTotal} label="Прогресс уроков" />
        </div>
      </section>

      <section className="asa-module-outcomes asa-container" aria-labelledby="asa-module-outcomes-title">
        <SectionHeading title="После модуля вы сможете" titleId="asa-module-outcomes-title" />
        <ol>
          {model.outcomes.map((outcome) => (
            <li key={outcome.order}>
              <span>{String(outcome.order).padStart(2, "0")}</span>
              <div><strong>{outcome.label}</strong><p>{outcome.text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="asa-module-content asa-container" aria-labelledby="asa-module-content-title">
        <SectionHeading title="Пять уроков и один проект" titleId="asa-module-content-title" />
        <ol className="asa-module-lessons">
          {model.lessons.map((lesson) => (
            <ModuleLessonBranch
              key={lesson.code}
              lesson={lesson}
              expanded={openLesson === lesson.code}
              onToggle={() => setOpenLesson((current) => current === lesson.code ? null : lesson.code)}
            />
          ))}
        </ol>
        {model.project ? (
          <article className="asa-module-project-row">
            <span>{model.project.code}</span>
            <div>
              <strong>{model.project.titleRu}</strong>
              <small>{model.project.titleEn}</small>
              <p>{model.project.objective}</p>
            </div>
            <StatusMark status={model.project.status} label={model.project.statusLabel} />
            <Button href={model.project.action.href} variant="line">{model.project.action.label}</Button>
          </article>
        ) : null}
      </section>

      {completionContent ? (
        <section className="asa-container asa-module-completion-wrap">
          {completionContent}
        </section>
      ) : null}

      {model.furtherStudy ? <ModuleFurtherStudySection model={model.furtherStudy} /> : null}
    </>
  );
}
