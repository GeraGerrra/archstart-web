import type { PracticeItemProps } from "./types";

export function PracticeItem({ model, exampleContent }: PracticeItemProps) {
  return (
    <div className="asa-item asa-practice-item">
      <section className="asa-practice-hero"><div><h2>{model.titleRu}</h2><p className="asa-subtitle">{model.titleEn}</p><p>{model.purpose}</p></div><dl><div><dt>Статус</dt><dd>{model.status}</dd></div><div><dt>Время</dt><dd>{model.estimatedTime}</dd></div></dl></section>
      <section className="asa-practice-tools"><header><h2>{model.toolsHeading}</h2></header><ul>{model.tools.map((tool) => <li key={tool}>{tool}</li>)}</ul></section>
      <section className="asa-practice-task"><header><h2>{model.studentTask}</h2></header><ol>{model.orderedSteps.map((step) => <li key={step.order}><span>{String(step.order).padStart(2, "0")}</span><p>{step.text}</p></li>)}</ol></section>
      {exampleContent ? (
        <section className="asa-our-example">
          <header><h2>Наш пример</h2><p>Используйте пример как ориентир для структуры, а не как шаблон для копирования.</p></header>
          {exampleContent}
        </section>
      ) : null}
      <section className="asa-self-check"><header><h2>Проверьте работу перед завершением</h2></header><div>{model.selfCheck.map((check, index) => <label key={check}><input type="checkbox" /><span>{check}</span><small>{String(index + 1).padStart(2, "0")}</small></label>)}</div></section>
    </div>
  );
}
