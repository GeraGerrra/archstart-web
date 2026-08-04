import Link from "next/link";
import type { LessonPagerViewModel } from "./types";

export interface LessonPagerProps {
  model: LessonPagerViewModel;
}

export function LessonPager({ model }: LessonPagerProps) {
  return (
    <nav className="asa-item-pager" aria-label="Навигация по уроку">
      {model.previous ? <Link href={model.previous.href}><span>{model.previous.contextLabel}</span><strong>{model.previous.displayLabel}</strong></Link> : <span />}
      <Link href={model.next.href}><span>{model.next.contextLabel}</span><strong>{model.next.displayLabel}</strong></Link>
    </nav>
  );
}
