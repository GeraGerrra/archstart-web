import type { ComponentPropsWithoutRef } from "react";
import { joinClassNames } from "./classNames";

type HiddenSpanProps = Omit<ComponentPropsWithoutRef<"span">, "className"> & {
  as?: "span";
  className?: string;
};

type HiddenParagraphProps = Omit<ComponentPropsWithoutRef<"p">, "className"> & {
  as: "p";
  className?: string;
};

export type VisuallyHiddenProps = HiddenSpanProps | HiddenParagraphProps;

/** Keeps content available to assistive technology without visual layout. */
export function VisuallyHidden(props: VisuallyHiddenProps) {
  if (props.as === "p") {
    const { as: _as, className, ...paragraphProps } = props;
    void _as;
    return <p {...paragraphProps} className={joinClassNames("asa-sr-only", className)} />;
  }

  const { as: _as, className, ...spanProps } = props;
  void _as;
  return <span {...spanProps} className={joinClassNames("asa-sr-only", className)} />;
}
