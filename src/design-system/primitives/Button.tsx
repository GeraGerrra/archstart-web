import Link from "next/link";
import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from "react";
import type { ButtonVariant } from "../types";
import { joinClassNames } from "./classNames";

interface ButtonBaseProps {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
}

type LinkButtonProps = ButtonBaseProps &
  Omit<ComponentProps<typeof Link>, "children" | "className"> & {
    href: ComponentProps<typeof Link>["href"];
  };

type NativeButtonProps = ButtonBaseProps &
  Omit<ComponentPropsWithoutRef<"button">, "children" | "className"> & {
    href?: never;
  };

export type ButtonProps = LinkButtonProps | NativeButtonProps;

function buttonClassName(variant: ButtonVariant, className?: string): string {
  return joinClassNames("asa-button", `asa-button--${variant}`, className);
}

function isLinkButton(props: ButtonProps): props is LinkButtonProps {
  return "href" in props && props.href !== undefined;
}

/**
 * Selected-A compatible action primitive. It renders a semantic Next link when
 * href is supplied and a native button otherwise.
 */
export function Button(props: ButtonProps) {
  if (isLinkButton(props)) {
    const { children, className, variant = "line", ...linkProps } = props;
    return (
      <Link {...linkProps} className={buttonClassName(variant, className)}>
        {children}
      </Link>
    );
  }

  const { children, className, variant = "line", type = "button", ...buttonProps } = props;
  return (
    <button {...buttonProps} type={type} className={buttonClassName(variant, className)}>
      {children}
    </button>
  );
}
