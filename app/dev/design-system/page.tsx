import { notFound } from "next/navigation";
import { DesignSystemShowcase } from "@/src/showcase";
import styles from "./showcase.module.css";

export const dynamic = "force-dynamic";

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignSystemShowcase className={styles.showcase} />;
}
