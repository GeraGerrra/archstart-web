import type { ComponentPropsWithoutRef } from "react";
import { joinClassNames } from "./classNames";

export type SkipLinkProps = ComponentPropsWithoutRef<"a">;

/** Keyboard-first skip link using the accepted selected-A focus treatment. */
export function SkipLink({ className, ...props }: SkipLinkProps) {
  return <a {...props} className={joinClassNames("asa-skip", className)} />;
}
