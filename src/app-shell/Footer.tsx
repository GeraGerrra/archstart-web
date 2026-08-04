import Link from "next/link";
import type { ShellFooterContent } from "./types";

export interface FooterProps {
  content: ShellFooterContent;
}

export function Footer({ content }: FooterProps) {
  return (
    <footer className="asa-footer">
      <div><strong>{content.brandLabel}</strong><span>{content.copy}</span></div>
      <div>{content.links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div>
    </footer>
  );
}
