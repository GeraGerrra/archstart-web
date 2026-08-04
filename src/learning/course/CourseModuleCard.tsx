import Image from "next/image";
import Link from "next/link";
import { Button, ProgressBar, StatusMark } from "@/src/design-system";
import type { CourseModuleCardDisplay } from "../types";

export interface CourseModuleCardProps {
  module: CourseModuleCardDisplay;
}

export function CourseModuleCard({ module }: CourseModuleCardProps) {
  return (
    <article className={`asa-course-module asa-course-module--${module.status}`}>
      <header>
        <div className="asa-course-module__visual">
          <Image
            src={module.cutout.src}
            alt={module.cutout.alt}
            width={module.cutout.width}
            height={module.cutout.height}
          />
        </div>
        <div className="asa-course-module__identity">
          <span>{module.code}</span>
          <div><h2>{module.titleRu}</h2><p>{module.titleEn}</p></div>
          <StatusMark status={module.status} />
        </div>
        <p>{module.goal}</p>
        <ProgressBar value={module.completedLessons} max={module.lessonTotal} label="Прогресс уроков" />
      </header>
      <ol className="asa-course-module__lessons">
        {module.lessons.map((lesson) => (
          <li key={lesson.code}>
            <StatusMark status={lesson.status} compact />
            <span>{lesson.shortCode}</span>
            <strong>{lesson.titleRu}</strong>
            {lesson.action
              ? <Link href={lesson.action.href}>{lesson.action.label}</Link>
              : <span>{lesson.quietStatusLabel}</span>}
          </li>
        ))}
      </ol>
      {module.project?.href ? (
        <Link href={module.project.href} className="asa-course-module__project">
          <span>{module.project.code}</span>
          <strong>{module.project.titleRu}</strong>
          <StatusMark status={module.project.status} compact />
        </Link>
      ) : module.project ? (
        <div className="asa-course-module__project">
          <span>{module.project.code}</span>
          <strong>{module.project.titleRu}</strong>
          <StatusMark status={module.project.status} compact />
        </div>
      ) : null}
      <Button href={module.href} variant="line">Обзор модуля</Button>
    </article>
  );
}
