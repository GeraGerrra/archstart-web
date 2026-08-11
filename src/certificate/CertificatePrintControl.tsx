"use client";

import { Button } from "@/src/design-system";

export function CertificatePrintControl() {
  return (
    <div className="asa-certificate-print-control asa-certificate-no-print">
      <Button type="button" variant="dark" onClick={() => window.print()}>
        Сохранить PDF
      </Button>
      <p>В системном окне печати выберите «Сохранить как PDF» и альбомную ориентацию.</p>
    </div>
  );
}
