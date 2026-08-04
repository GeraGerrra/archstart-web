import Link from "next/link";
import { Button, StatusMark } from "@/src/design-system";
import type { ModuleNavigationItem } from "./types";

export interface ModuleMenuPanelProps {
  module: ModuleNavigationItem;
  panelAriaLabelPrefix: string;
  lessonCountSuffix: string;
  openLessonLabel: string;
  openModuleLabel: string;
}

export function ModuleMenuPanel({
  module,
  panelAriaLabelPrefix,
  lessonCountSuffix,
  openLessonLabel,
  openModuleLabel,
}: ModuleMenuPanelProps) {
  const projectContent = (
    <>
      <span>{module.project.code}</span>
      <strong>{module.project.titleRu}</strong>
      <StatusMark status={module.project.status} compact />
    </>
  );

  return (
    <div className="asa-module-panel" data-module-panel={module.code} role="dialog" aria-label={`${panelAriaLabelPrefix} ${module.code}`}>
      <div className="asa-module-panel__head">
        <div className="asa-module-panel__code">{module.code}</div>
        <div>
          <strong>{module.titleRu}</strong>
          <span>{module.titleEn}</span>
        </div>
        <div className="asa-module-panel__progress">
          <span>{module.completedLessonCount} / {module.lessonTotal} {lessonCountSuffix}</span>
          <progress value={module.completedLessonCount} max={module.lessonTotal}>{module.completedLessonCount} из {module.lessonTotal}</progress>
        </div>
      </div>
      <ol className="asa-module-panel__lessons">
        {module.lessons.map((lesson) => (
          <li key={lesson.code}>
            <StatusMark status={lesson.status} compact />
            <div>
              <span>{lesson.displayCode}</span>
              <strong>{lesson.titleRu}</strong>
            </div>
            {lesson.href ? (
              <Link href={lesson.href}>{openLessonLabel}</Link>
            ) : (
              <span className="asa-module-panel__quiet">{lesson.quietStatusLabel}</span>
            )}
          </li>
        ))}
      </ol>
      {module.project.href ? (
        <Link className="asa-module-panel__project" href={module.project.href}>
          {projectContent}
        </Link>
      ) : (
        <div className="asa-module-panel__project">{projectContent}</div>
      )}
      <Button className="asa-module-panel__open" href={module.href} variant="dark">
        {openModuleLabel}
      </Button>
    </div>
  );
}
