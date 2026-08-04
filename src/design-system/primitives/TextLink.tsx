import Link from "next/link";
import type { ComponentProps } from "react";
import { joinClassNames } from "./classNames";

export type TextLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  className?: string;
};

/** Underlined selected-A route link with the accepted class contract. */
export function TextLink({ className, ...props }: TextLinkProps) {
  return <Link {...props} className={joinClassNames("asa-text-link", className)} />;
}
