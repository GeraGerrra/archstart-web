import Link from "next/link";
import { Button, StatusMark } from "@/src/design-system";
import type { PublicCertificateVerification } from "./types";
import { CertificateArtwork } from "./CertificateArtwork";
import { CertificatePrintControl } from "./CertificatePrintControl";

export function PublicCertificateVerificationPage({
  verification,
}: {
  verification: PublicCertificateVerification;
}) {
  if (!verification.found) {
    return (
      <main className="asa-public-certificate-page">
        <Link href="/prototype/a/home" className="asa-public-certificate-page__brand">ARCH.START</Link>
        <section className="asa-public-certificate-record" aria-labelledby="certificate-not-found-title">
          <span className="asa-kicker">ПРОВЕРКА СЕРТИФИКАТА</span>
          <h1 id="certificate-not-found-title">Сертификат не найден</h1>
          <p>Проверьте код или запросите у владельца актуальную ссылку.</p>
        </section>
      </main>
    );
  }

  const revoked = verification.status === "REVOKED";
  const certificateCode = verification.certificateCode;
  const displayName = verification.displayName;
  const courseTitle = verification.courseTitle;
  const courseVersion = verification.courseVersion;
  const issuedAt = verification.issuedAt;

  if (!certificateCode || !displayName || !courseTitle || !courseVersion || !issuedAt) {
    return (
      <main className="asa-public-certificate-page">
        <Link href="/prototype/a/home" className="asa-public-certificate-page__brand">ARCH.START</Link>
        <section className="asa-public-certificate-record" aria-labelledby="certificate-not-found-title">
          <span className="asa-kicker">ПРОВЕРКА СЕРТИФИКАТА</span>
          <h1 id="certificate-not-found-title">Сертификат не найден</h1>
          <p>Проверьте код или запросите у владельца актуальную ссылку.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="asa-public-certificate-page asa-public-certificate-page--found">
      <header className="asa-public-certificate-page__verification-head asa-certificate-no-print">
        <div>
          <Link href="/prototype/a/home" className="asa-public-certificate-page__brand">ARCH.START</Link>
          <span className="asa-kicker">ПРОВЕРКА СЕРТИФИКАТА</span>
          <h1>{revoked ? "Сертификат отозван" : "Сертификат действителен"}</h1>
          <p>
            {revoked
              ? "Публичная запись существует, но сертификат больше не является действительным."
              : "Код, имя, версия курса и дата выпуска подтверждены сервером ARCH.START."}
          </p>
        </div>
        <StatusMark
          status={revoked ? "locked" : "complete"}
          label={revoked ? "REVOKED" : "VALID"}
        />
      </header>

      <div className="asa-certificate-print-root">
        <CertificateArtwork
          certificateCode={certificateCode}
          courseTitle={courseTitle}
          courseVersion={courseVersion}
          displayName={displayName}
          issuedAt={issuedAt}
          status={revoked ? "REVOKED" : "VALID"}
        />
      </div>

      <div className="asa-public-certificate-page__actions asa-certificate-no-print">
        <CertificatePrintControl />
        <Button href="/prototype/a/home">Вернуться на ARCH.START</Button>
      </div>
    </main>
  );
}
