import Link from "next/link";
import type { LessonHeaderViewModel } from "./types";

export interface LessonHeaderProps {
  model: LessonHeaderViewModel;
}

export function LessonHeader({ model }: LessonHeaderProps) {
  return (
    <header className="asa-item-head">
      <nav aria-label="Хлебные крошки"><Link href={model.breadcrumbs.course.href}>{model.breadcrumbs.course.label}</Link><span>/</span><Link href={model.breadcrumbs.module.href}>{model.breadcrumbs.module.label}</Link><span>/</span><Link href={model.breadcrumbs.lesson.href}>{model.breadcrumbs.lesson.label}</Link><span>/</span><strong>{model.breadcrumbs.activeItemLabel}</strong></nav>
      <div className="asa-item-head__identity"><span>{model.lessonDisplayCode}</span><div><h1>{model.activeItemTitleRu}</h1><p>{model.activeItemTitleEn}</p></div></div>
      <div className="asa-item-head__lesson"><strong>{model.lessonTitleRu}</strong><span>{model.lessonTitleEn}</span></div>
    </header>
  );
}
