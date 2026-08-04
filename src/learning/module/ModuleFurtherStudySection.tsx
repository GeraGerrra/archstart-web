import type { ModuleFurtherStudyViewModel } from "../types";

export interface ModuleFurtherStudySectionProps {
  model: ModuleFurtherStudyViewModel;
}

export function ModuleFurtherStudySection({ model }: ModuleFurtherStudySectionProps) {
  return (
    <section className="asa-container asa-further-study" aria-labelledby="asa-further-study-title">
      <div className="asa-further-study__header">
        <p className="asa-further-study__kicker">{model.kicker}</p>
        <h2 id="asa-further-study-title">{model.title}</h2>
        <p>{model.description}</p>
      </div>
      <ul className="asa-further-study__grid">
        {model.resources.map((resource) => (
          <li key={resource.id} className="asa-further-study__card">
            <div className="asa-further-study__tags" aria-label="Язык и уровень курса">
              <span>{resource.language}</span>
              <span>{resource.level}</span>
            </div>
            <h3>{resource.title}</h3>
            <p className="asa-further-study__provider">{resource.provider}</p>
            <p className="asa-further-study__description">{resource.description}</p>
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer external"
              aria-label={`Открыть курс «${resource.title}» на сайте ${resource.provider} в новой вкладке`}
            >
              Открыть курс ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
