import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "ARCH.START — Visual Prototype",
  description: "Phase 02 local visual prototype. Not a production course route.",
  robots: { index: false, follow: false, nocache: true },
};

export default function PrototypesLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
