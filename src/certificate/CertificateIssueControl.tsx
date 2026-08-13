"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/design-system";
import type { CertificateIssueActionResult } from "./types";
import { issueMyCourseCertificateAction } from "@/src/server/certificate-actions";

export function CertificateIssueControl({
  buttonLabel = "Сформировать сертификат",
}: {
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CertificateIssueActionResult | null>(null);

  function issueCertificate(): void {
    if (pending) return;
    setResult(null);
    startTransition(async () => {
      const nextResult = await issueMyCourseCertificateAction();
      setResult(nextResult);
      if (nextResult.status === "success") {
        router.push("/certificate");
        router.refresh();
      }
    });
  }

  return (
    <div className="asa-certificate-issue-control">
      <Button
        type="button"
        variant="dark"
        disabled={pending}
        aria-disabled={pending}
        onClick={issueCertificate}
      >
        {pending ? "Проверяем готовность…" : buttonLabel}
      </Button>
      <p className="asa-certificate-issue-control__message" aria-live="polite">
        {result?.message ?? ""}
      </p>
    </div>
  );
}
