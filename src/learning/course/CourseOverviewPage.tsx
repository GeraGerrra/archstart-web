import { Button, SectionHeading } from "@/src/design-system";
import { CourseModuleCard } from "./CourseModuleCard";
import type { CourseOverviewViewModel } from "../types";

export interface CourseOverviewPageProps {
  model: CourseOverviewViewModel;
}

export function CourseOverviewPage({ model }: CourseOverviewPageProps) {
  return (
    <>
      <section className="asa-course-hero asa-container">
        <div>
          <h1>{model.title}</h1>
          <p className="asa-lead">{model.summary}</p>
          <p className="asa-demo-note">{model.demoDisclosure}</p>
          <Button href={model.continueAction.href} variant="dark">{model.continueAction.label}</Button>
        </div>
        <div className="asa-course-summary">
          <div
            className="asa-course-summary__ring"
            aria-label={`${model.totals.completedLessons} завершено из ${model.totals.lessonTotal} уроков`}
          >
            <strong>{model.totals.completedLessons}</strong>
            <span>/ {model.totals.lessonTotal} уроков</span>
          </div>
          <dl>
            <div><dt>{model.totals.completedModules} / {model.totals.moduleTotal}</dt><dd>модулей завершено</dd></div>
            <div><dt>{model.totals.completedProjects} / {model.totals.projectTotal}</dt><dd>проектов завершено</dd></div>
            <div><dt>{model.totals.quizQuestions}</dt><dd>вопросов в курсе</dd></div>
          </dl>
        </div>
      </section>
      <section className="asa-course-list asa-container" aria-labelledby="asa-course-list-title">
        <SectionHeading title={model.moduleListTitle} titleId="asa-course-list-title" />
        <div className="asa-course-list__grid">
          {model.modules.map((module) => <CourseModuleCard key={module.code} module={module} />)}
        </div>
      </section>
    </>
  );
}
