import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "ARCH.START — Selected A IA Prototype",
  description: "Phase 02 selected Studio Precision learning information architecture prototype.",
  robots: { index: false, follow: false, nocache: true },
};

export default function PrototypeLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
