import { Button } from "@/src/design-system";
import type { ProjectContentBlock, ProjectOverviewPageProps } from "../types";

function ProjectContent({ block }: { block: ProjectContentBlock }) {
  if (block.type === "table" && block.rows) {
    return (
      <div className={`asa-project-content__table${block.rows.every((row) => row.length === 1) ? " is-callout" : ""}`}>
        <table>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${block.order}-${rowIndex}`}>
                {row.map((cell, cellIndex) => rowIndex === 0 && block.rows!.length > 1 ? (
                  <th key={`${block.order}-${rowIndex}-${cellIndex}`} scope="col">{cell}</th>
                ) : cellIndex === 0 && row.length > 1 ? (
                  <th key={`${block.order}-${rowIndex}-${cellIndex}`} scope="row">{cell}</th>
                ) : <td key={`${block.order}-${rowIndex}-${cellIndex}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!block.text) return null;
  if (block.style === "AS H1") return <h2>{block.text.replace(/^\d{2}\s+/, "")}</h2>;
  if (block.style === "AS H2") return <h3>{block.text}</h3>;
  if (block.style === "AS Small") return <p className="asa-project-content__small">{block.text}</p>;
  return <p>{block.text}</p>;
}

export function ProjectOverviewPage({ model, exampleContent, workspaceContent }: ProjectOverviewPageProps) {
  return (
    <section className="asa-project asa-container">
      <header className="asa-project__hero">
        <span className="asa-kicker">{model.kicker}</span>
        <div><span>{model.code}</span><h1>{model.titleRu}</h1><p>{model.titleEn}</p></div>
        <p className="asa-lead">{model.objective}</p>
      </header>
      {model.contentBlocks?.length ? (
        <div className="asa-project-content">
          {model.contentBlocks.map((block) => block.order === model.exampleBlockOrder ? (
            <section className="asa-project-content__example" key={block.order}>
              <h2>Наш пример</h2>
              <p>Сначала соберите собственное решение, затем откройте пример и сравните структуру доказательств.</p>
              {exampleContent}
            </section>
          ) : block.order === model.exampleCaptionBlockOrder ? null : <ProjectContent block={block} key={block.order} />)}
        </div>
      ) : exampleContent}
      <section className="asa-project__outcomes">
        <h2>Проверяемые результаты</h2>
        <ol>
          {model.assessedOutcomes.map((outcome) => (
            <li key={outcome.order}>
              <span>{String(outcome.order).padStart(2, "0")}</span>
              <div><strong>{outcome.label}</strong><p>{outcome.text}</p></div>
            </li>
          ))}
        </ol>
      </section>
      {workspaceContent}
      <Button href={model.backAction.href} variant="line">{model.backAction.label}</Button>
    </section>
  );
}
