import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { joinClassNames } from "./classNames";

export interface SectionHeadingProps extends Omit<ComponentPropsWithoutRef<"header">, "children" | "title"> {
  action?: ReactNode;
  title: ReactNode;
  titleId?: string;
}

/** Accepted selected-A section header DOM: header, title wrapper, h2, action. */
export function SectionHeading({ action, className, title, titleId, ...headerProps }: SectionHeadingProps) {
  return (
    <header {...headerProps} className={joinClassNames("asa-section-head", className)}>
      <div><h2 id={titleId}>{title}</h2></div>
      {action}
    </header>
  );
}
