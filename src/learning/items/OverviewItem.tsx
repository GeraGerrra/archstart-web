import Link from "next/link";
import { Button } from "@/src/design-system";
import type { OverviewItemViewModel } from "./types";

export interface OverviewItemProps {
  model: OverviewItemViewModel;
}

export function OverviewItem({ model }: OverviewItemProps) {
  return (
    <div className="asa-item asa-overview-item">
      <section className="asa-overview-intro"><h2>{model.lessonTitleRu}</h2><p className="asa-subtitle">{model.lessonTitleEn}</p><p className="asa-lead">{model.objective}</p><div className="asa-overview-intro__meta"><div><span>{model.duration.label}</span><strong>{model.duration.value}</strong></div><div><span>{model.itemCount.label}</span><strong>{model.itemCount.value}</strong></div><div><span>{model.outcomeCount.label}</span><strong>{model.outcomeCount.value}</strong></div></div><Button href={model.startAction.href} variant="dark">{model.startAction.label}</Button></section>
      <section className="asa-overview-outcomes"><header><h2>После урока вы сможете</h2></header><ol>{model.outcomes.map((outcome) => <li key={outcome.order}><span>{String(outcome.order).padStart(2, "0")}</span><div><strong>{outcome.label}</strong><p>{outcome.text}</p></div></li>)}</ol></section>
      <section className="asa-overview-route"><header><h2>Маршрут урока</h2></header><ol>{model.route.map((entry) => <li key={entry.order}><span>{String(entry.order).padStart(2, "0")}</span><div><strong>{entry.titleRu}</strong><small>{entry.titleEn}</small><p>{entry.summary}</p></div><Link href={entry.action.href}>{entry.action.label}</Link></li>)}</ol></section>
    </div>
  );
}
