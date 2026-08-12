import Link from "next/link";
import { Button, ProgressBar, SectionHeading, StatusMark } from "@/src/design-system";
import type { DashboardViewModel } from "../types";
import { CertificateDashboardCard } from "@/src/certificate";
import type { MyCertificateProjection } from "@/src/certificate/types";

export interface DashboardPageProps {
  model: DashboardViewModel;
  certificateProjection?: MyCertificateProjection;
}

export function DashboardPage({ model, certificateProjection }: DashboardPageProps) {
  return (
    <section className="asa-dashboard asa-container">
      <header className="asa-dashboard__hero">
        <div>
          <h1>{model.title}</h1>
          <p>{model.disclosure}</p>
          {model.profileAction ? (
            <Link href={model.profileAction.href} className="asa-text-link">
              {model.profileAction.label}
            </Link>
          ) : null}
        </div>
        <div>
          <strong>{model.completedLessons}</strong>
          <span>из {model.lessonTotal} уроков</span>
          <progress value={model.completedLessons} max={model.lessonTotal}>
            {model.completedLessons} из {model.lessonTotal}
          </progress>
        </div>
      </header>
      <section className="asa-continue">
        <span className="asa-continue__code">{model.continueLearning.code}</span>
        <div>
          <h2>{model.continueLearning.titleRu}</h2>
          <p>{model.continueLearning.titleEn}</p>
        </div>
        <Button href={model.continueLearning.action.href} variant="dark">
          {model.continueLearning.action.label}
        </Button>
      </section>
      <div className="asa-dashboard__grid">
        <section>
          <SectionHeading title={model.moduleMapTitle} />
          <ol className="asa-dashboard-map">
            {model.modules.map((module) => (
              <li key={module.code}>
                <span>{module.code}</span>
                <div><strong>{module.titleRu}</strong><small>{module.titleEn}</small></div>
                <ProgressBar
                  value={module.completedLessons}
                  max={module.lessonTotal}
                  label={module.progressLabel}
                />
                <Link href={module.action.href}>{module.action.label}</Link>
              </li>
            ))}
          </ol>
        </section>
        <aside className="asa-history-empty">
          <h2>{model.emptyHistory.title}</h2>
          <p>{model.emptyHistory.description}</p>
          <dl>
            {model.emptyHistory.records.map((record) => (
              <div key={record.label}><dt>{record.label}</dt><dd>{record.value}</dd></div>
            ))}
          </dl>
        </aside>
      </div>
      {model.projects ? (
        <section className="asa-dashboard-projects" aria-labelledby="dashboard-projects-title">
          <header>
            <SectionHeading title="Проекты модулей" />
            {model.staffReviewAction ? (
              <Button href={model.staffReviewAction.href} variant="dark">
                {model.staffReviewAction.label}
              </Button>
            ) : null}
          </header>
          <h2 id="dashboard-projects-title" className="asa-visually-hidden">Статусы восьми проектов</h2>
          <ol>
            {model.projects.map((project) => (
              <li key={project.projectCode}>
                <span>{project.projectCode}</span>
                <strong>{project.titleRu}</strong>
                <StatusMark
                  status={project.status === "accepted" ? "complete" : project.status === "none" ? "available" : "in-progress"}
                  label={project.statusLabel}
                />
                <Button href={project.action.href}>{project.action.label}</Button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {certificateProjection ? (
        <CertificateDashboardCard projection={certificateProjection} />
      ) : null}
    </section>
  );
}
