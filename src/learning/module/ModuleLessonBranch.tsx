import Link from "next/link";
import { StatusMark } from "@/src/design-system";
import type { ModuleLessonBranchDisplay } from "../types";

export interface ModuleLessonBranchProps {
  lesson: ModuleLessonBranchDisplay;
  expanded: boolean;
  onToggle: () => void;
}

export function ModuleLessonBranch({ lesson, expanded, onToggle }: ModuleLessonBranchProps) {
  return (
    <li className={`asa-module-lesson${expanded ? " is-open" : ""}`}>
      <button type="button" className="asa-module-lesson__row" onClick={onToggle} aria-expanded={expanded}>
        <span className="asa-module-lesson__index">{String(lesson.order).padStart(2, "0")}</span>
        <div><span>{lesson.code}</span><strong>{lesson.titleRu}</strong><small>{lesson.titleEn}</small></div>
        <StatusMark status={lesson.status} />
        <span className="asa-module-lesson__toggle" aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded ? (
        <div className="asa-module-lesson__branch">
          <p>{lesson.objective}</p>
          <ol>
            {lesson.items.map((item, index) => (
              <li key={item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.titleRu}</strong><small>{item.titleEn}</small></div>
                {item.action
                  ? <Link href={item.action.href}>{item.action.label}</Link>
                  : <span className="asa-quiet">{item.pendingLabel}</span>}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </li>
  );
}
