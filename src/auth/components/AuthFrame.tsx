import type { ReactNode } from "react";
import Link from "next/link";
import { SelectedAShell } from "@/src/prototypes/selected-a/shell-adapter";

export interface AuthFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthFrame({ eyebrow, title, description, children, footer }: AuthFrameProps) {
  return (
    <SelectedAShell active="account">
      <section className="asa-auth asa-container">
        <div className="asa-auth__intro">
          <span className="asa-kicker">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <Link className="asa-text-link" href="/course">К публичному курсу</Link>
        </div>
        <div className="asa-auth__panel">
          {children}
          {footer ? <div className="asa-auth__footer">{footer}</div> : null}
        </div>
      </section>
    </SelectedAShell>
  );
}
