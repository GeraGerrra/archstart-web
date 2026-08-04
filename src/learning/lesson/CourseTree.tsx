import Link from "next/link";
import { StatusMark } from "@/src/design-system";
import type { CourseTreeItemState, CourseTreeViewModel } from "./types";

export interface CourseTreeProps {
  model: CourseTreeViewModel;
  onNavigate?: () => void;
}

const ITEM_STATE_SYMBOL: Readonly<Record<CourseTreeItemState, string>> = {
  current: "●",
  completed: "✓",
  future: "○",
};

export function CourseTree({ model, onNavigate }: CourseTreeProps) {
  return (
    <nav className="asa-course-tree" aria-label={model.ariaLabel}>
      <div className="asa-course-tree__module">
        <span>{model.module.code}</span><div><strong>{model.module.titleRu}</strong><small>{model.module.titleEn}</small></div>
      </div>
      <ol className="asa-course-tree__lessons">
        {model.lessons.map((lesson) => (
          <li key={lesson.code} className={lesson.open ? "is-open" : ""}>
            <div className="asa-course-tree__lesson-row">
              <StatusMark status={lesson.status} compact />
              <Link href={lesson.href} onClick={onNavigate}>
                <span>{lesson.shortCode}</span><strong>{lesson.titleRu}</strong>
              </Link>
            </div>
            {lesson.open ? (
              <ol className="asa-course-tree__items">
                {lesson.items.map((item) => (
                  <li key={item.id} className={item.state === "current" ? "is-current" : ""}>
                    <span className="asa-course-tree__item-state" aria-hidden="true">{ITEM_STATE_SYMBOL[item.state]}</span>
                    <Link href={item.href} aria-current={item.state === "current" ? "page" : undefined} onClick={onNavigate}>{item.title}</Link>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
      <Link className="asa-course-tree__project" href={model.project.href} onClick={onNavigate}><span>{model.project.code}</span><strong>{model.project.titleRu}</strong></Link>
    </nav>
  );
}
