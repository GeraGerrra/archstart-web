import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "ARCH.START — Phase 02 Prototype Review",
  description: "Neutral comparison workspace for three isolated ARCH.START visual prototype directions.",
  robots: { index: false, follow: false, nocache: true },
};

export default function PrototypeReviewLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
